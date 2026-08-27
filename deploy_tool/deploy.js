const fs = require('fs');
const archiver = require('archiver');
const { Client } = require('ssh2');
const path = require('path');

const host = '103.247.11.248';
const username = 'root';
const password = 'AB%L6Kz215Rqn#';
const domain = 'devtrack.agamlabs.cloud';
const sourceDir = path.resolve(__dirname, '..');
const zipFile = path.resolve(sourceDir, 'devtrack.tar.gz');
const remotePath = `/var/www/devtrack`;

const { execSync } = require('child_process');

async function createZip() {
  return new Promise((resolve, reject) => {
    console.log('Creating tar.gz archive using native tar...');
    try {
      execSync('tar.exe -czf devtrack.tar.gz --exclude="node_modules" --exclude=".next" --exclude=".git" --exclude="deploy_tool" --exclude="devtrack.tar.gz" *', {
        cwd: sourceDir,
        stdio: 'inherit'
      });
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

function execCommand(conn, cmd, ignoreError = false) {
  return new Promise((resolve, reject) => {
    console.log(`Executing: ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('close', (code, signal) => {
        if (code !== 0 && !ignoreError) {
            return reject(new Error(`Command failed with code ${code}: ${out}`));
        }
        resolve(out);
      }).on('data', (data) => {
        out += data;
        process.stdout.write(data);
      }).stderr.on('data', (data) => {
        out += data;
        process.stderr.write(data);
      });
    });
  });
}

async function deploy() {
  try {
    await createZip();
    console.log('Zip created, connecting to VPS...');
    
    const conn = new Client();
    conn.on('ready', async () => {
      console.log('SSH Connection ready.');
      
      try {
        // 1. Provisioning (Install missing build tools)
        await execCommand(conn, 'apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y build-essential make g++ python3 unzip');
        
        // 2. Upload
        console.log('Uploading zip file...');
        await new Promise((resolve, reject) => {
          conn.sftp((err, sftp) => {
            if (err) return reject(err);
            sftp.fastPut(zipFile, '/tmp/devtrack.tar.gz', (err) => {
              if (err) return reject(err);
              resolve();
            });
          });
        });
        
        // 3. Extract and setup
        await execCommand(conn, `mkdir -p ${remotePath}`);
        await execCommand(conn, `tar -xzf /tmp/devtrack.tar.gz -C ${remotePath} || true`);
        
        // 4. Build
        console.log('Building Next.js on server...');
        await execCommand(conn, `cd ${remotePath} && npm install --omit=dev --legacy-peer-deps || npm install --legacy-peer-deps`);
        await execCommand(conn, `cd ${remotePath} && npm run build`);
        
        // 5. Start with PM2
        await execCommand(conn, `cd ${remotePath} && pm2 delete devtrack || true`, true);
        await execCommand(conn, `cd ${remotePath} && pm2 start server.js --name "devtrack"`);
        await execCommand(conn, `pm2 save`);
        await execCommand(conn, `env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root || true`, true);
        
        // 6. Nginx setup
        const nginxConfig = `
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
    }
}
`;
        await execCommand(conn, `echo "${nginxConfig.replace(/\$/g, '\\$').replace(/\\\$host/g, '$host').replace(/\\\$http_upgrade/g, '$http_upgrade')}" > /etc/nginx/sites-available/devtrack`);
        await execCommand(conn, `ln -sf /etc/nginx/sites-available/devtrack /etc/nginx/sites-enabled/`);
        await execCommand(conn, `rm -f /etc/nginx/sites-enabled/default`);
        await execCommand(conn, `nginx -t && systemctl restart nginx`);
        
        // 7. SSL with Certbot
        console.log('Setting up SSL...');
        try {
            await execCommand(conn, `certbot --nginx -d ${domain} --non-interactive --agree-tos -m admin@agamlabs.cloud --redirect`, true);
        } catch (e) {
            console.log("Certbot might have failed or DNS not propagated. Error: " + e.message);
        }
        
        console.log('Deployment complete!');
        conn.end();
      } catch (err) {
        console.error('Error during deployment steps:', err);
        conn.end();
      }
    }).on('error', (err) => {
        console.error('SSH Connection error:', err);
    }).connect({
      host: host,
      port: 22,
      username: username,
      password: password,
      keepaliveInterval: 10000
    });
  } catch (err) {
    console.error('Initial error:', err);
  }
}

deploy();
