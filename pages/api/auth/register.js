import { queryOne, insert } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { createTenant, joinTenantByInvite } from '@/lib/tenant'
import { validateData } from '@/lib/middleware'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate input
  const { valid, data, errors } = validateData(req.body, 'register')
  if (!valid) {
    return res.status(400).json({ error: 'Validation failed', details: errors })
  }

  const { name, email, password, mode, workspaceName, inviteCode } = data

  try {
    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email])
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' })
    }

    const userCountRes = await queryOne('SELECT COUNT(*) as count FROM users');
    const isFirstUser = userCountRes.count === 0;
    const isApproved = isFirstUser ? 1 : 0;
    const hashedPassword = await hashPassword(password);

    // Create user first (without tenant_id — will be set below)
    const result = await insert('users', {
      name,
      email,
      password: hashedPassword,
      role: 'member',
      is_approved: isApproved,
      created_at: new Date(),
    })

    const userId = result.insertId
    let tenantId = null

    if (mode === 'create') {
      // User wants to create a new workspace — create tenant + set as owner
      if (!workspaceName || workspaceName.trim().length < 2) {
        return res.status(400).json({ error: 'Workspace name must be at least 2 characters' })
      }

      const slug = workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        + '-' + Date.now().toString(36)

      tenantId = await createTenant(workspaceName.trim(), slug, userId)

      // Update user with tenant_id + role admin
      await insert(
        'UPDATE users SET tenant_id = ?, role = ? WHERE id = ?',
        [tenantId, 'admin', userId]
      )

    } else if (mode === 'join' && inviteCode) {
      // User wants to join existing workspace via invite code
      const joinResult = await joinTenantByInvite(userId, inviteCode)
      if (!joinResult.success) {
        return res.status(400).json({ error: joinResult.error })
      }
      tenantId = joinResult.tenantId

      // Update user with tenant_id
      await insert(
        'UPDATE users SET tenant_id = ? WHERE id = ?',
        [tenantId, userId]
      )

    } else {
      // Default: create a personal workspace
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36)
      tenantId = await createTenant(name + "'s Workspace", slug, userId)
      await insert(
        'UPDATE users SET tenant_id = ?, role = ? WHERE id = ?',
        [tenantId, 'admin', userId]
      )
    }

    if (!isApproved) {
      const jwt = require('jsonwebtoken');
      const { sendEmail } = require('@/lib/email');
      
      const adminEmail = 'agamsuryag@gmail.com'; // Hardcoded admin email for approvals
      const token = jwt.sign({ userId, action: 'approve' }, process.env.JWT_SECRET, { expiresIn: '7d' });
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const approveLink = `${appUrl}/api/admin/approve-user?token=${token}`;
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
          <h2 style="color: #333;">New Registration Request</h2>
          <p style="color: #555;">A new user has registered on DevTrack and is waiting for your approval to access the system.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
          </div>
          <a href="${approveLink}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;text-align:center;width:100%;box-sizing:border-box;">Approve User Now</a>
          <p style="color: #888; font-size: 12px; margin-top: 20px;">If you do not recognize this request, you can safely ignore this email.</p>
        </div>
      `;
      
      await sendEmail(adminEmail, 'DevTrack - New Registration Approval', emailHtml).catch(e => console.error('Failed to send approval email:', e));
    }

    return res.status(201).json({
      message: isApproved ? 'Account created successfully' : 'Account created and is pending admin approval',
      userId,
      tenantId,
      mode: mode || 'auto',
    })
  } catch (error) {
    console.error('Register error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
