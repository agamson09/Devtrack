import { csrfFetch } from '@/lib/csrfFetch';
import { useState, useEffect, useRef, useCallback } from 'react'
import Layout from '@/components/layout/Layout'
import { useAuth } from '@/components/AuthContext'
import Avatar from '@/components/common/Avatar'
import { useCall } from '@/components/call/CallContext'

const EMOJI_DATA = [
  { label: 'Smileys', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','🫥','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'] },
  { label: 'Gestures', emojis: ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄'] },
  { label: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','🫶','😍','🥰','😘','💑','💏'] },
  { label: 'Objects', emojis: ['⌚','📱','📲','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️','🪔','🧯','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','🪬','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','💊','💉','🩸','🧬','🦠','🧫','🧪','🌡️','🧹','🪠','🧺','🧻','🚽','🚰','🚿','🛁','🛀','🧼','🪥','🪒','🧽','🪣','🧴','🛎️','🔑','🗝️','🚪','🪑','🛋️','🛏️','🛌','🧸','🪆','🖼️','🪞','🪟','🧷','🪶','🧸','🪅','🪆','🎐','🎑','🧧','🎁','🎀','🎗️','🏆','🏅','🥇','🥈','🥉','⚽','⚾','🥎','🏀','🏐','🏈','🏉','🎾','🥏','🎳','🏏','🏑','🏒','🥍','🏓','🏸','🥊','🥋','🥅','⛳','⛸️','🎣','🤿','🎽','🎿','🛷','🥌','🎯','🪀','🪁','🎱','🔮','🪄','🧿','🎮','🕹️','🎰','🎲'] },
  { label: 'Symbols', emojis: ['💯','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🟤','🔺','🔻','💠','🔶','🔷','🔳','🔲','▪️','▫️','◾','◽','◼️','◻️','🟥','🟧','🟨','🟩','🟦','🟪','⬛','⬜','🟫','➕','➖','➗','✖️','🟰','♾️','‼️','⁉️','❓','❔','❕','❗','〰️','💱','💲','⚕️','♻️','⚜️','🔱','📛','🔰','⭕','✅','☑️','✔️','❌','❎','➰','➿','〽️','✳️','✴️','❇️','©️','®️','™️'] },
]

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏']

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }
  return text.replace(/[&<>"']/g, c => map[c])
}

function parseMessage(text, allUsers, allProjects) {
  if (!text) return ''
  const safeText = escapeHtml(text)
  const regex = /(@\w[\w\s]*?\w|#\w[\w\s]*?\w)/g
  const matches = []
  let match
  while ((match = regex.exec(text)) !== null) {
    matches.push({ full: match[0], index: match.index, length: match[0].length })
  }
  if (matches.length === 0) return safeText
  const elements = []
  let cursor = 0
  for (const m of matches) {
    if (m.index > cursor) elements.push(safeText.slice(cursor, m.index))
    if (m.full.startsWith('@')) {
      const name = m.full.slice(1)
      const u = allUsers.find(u => u.name.toLowerCase() === name.toLowerCase() || u.name.toLowerCase().startsWith(name.toLowerCase()))
      if (u) elements.push(`<span class="text-indigo-400 font-semibold bg-indigo-400/10 px-1 rounded cursor-pointer">@${escapeHtml(u.name)}</span>`)
      else elements.push(escapeHtml(m.full))
    } else if (m.full.startsWith('#')) {
      const name = m.full.slice(1)
      const p = allProjects.find(p => p.name.toLowerCase() === name.toLowerCase() || p.name.toLowerCase().startsWith(name.toLowerCase()))
      if (p) elements.push(`<a href="/dashboard/projects/${p.id}" class="text-emerald-400 font-semibold bg-emerald-400/10 px-1 rounded hover:underline no-underline">#${escapeHtml(p.name)}</a>`)
      else elements.push(escapeHtml(m.full))
    }
    cursor = m.index + m.length
  }
  if (cursor < safeText.length) elements.push(safeText.slice(cursor))
  return elements.join('')
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > 1200) { h = Math.round((h * 1200) / w); w = 1200 }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob((blob) => blob ? resolve(new File([blob], file.name || `image-${Date.now()}.jpg`, { type: 'image/jpeg' })) : reject(new Error('null')), 'image/jpeg', 0.7)
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target.result
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div ref={ref} className="absolute bottom-14 left-0 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-700 overflow-x-auto">
        {EMOJI_DATA.map((cat, i) => (
          <button key={i} onClick={() => setActiveCategory(i)} className={`px-2 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${activeCategory === i ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>{cat.label}</button>
        ))}
      </div>
      <div className="p-2">
        <input type="text" placeholder="Search emoji..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2" />
        <div className="grid grid-cols-8 gap-0.5 max-h-52 overflow-y-auto">
          {(searchQuery ? EMOJI_DATA.flatMap(c => c.emojis) : EMOJI_DATA[activeCategory].emojis).filter(e => !searchQuery || e.includes(searchQuery)).map((emoji, i) => (
            <button key={i} onClick={() => { onSelect(emoji); onClose() }} className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-700 rounded-md transition-colors">{emoji}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function CreateGroupModal({ users, currentUser, onClose, onCreate }) {
  const [groupName, setGroupName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState([])
  const [search, setSearch] = useState('')
  function toggleMember(uid) { setSelectedMembers(p => p.includes(uid) ? p.filter(id => id !== uid) : [...p, uid]) }
  function handleCreate() { if (!groupName.trim()) return; onCreate({ name: groupName.trim(), memberIds: selectedMembers }); onClose() }
  const filtered = users.filter(u => u.id !== currentUser?.id && (!search || u.name.toLowerCase().includes(search.toLowerCase())))
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Create Group</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Group Name</label>
            <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Enter group name..." className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" autoFocus />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Add Members</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 mb-2" />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filtered.map(u => (
                <button key={u.id} onClick={() => toggleMember(u.id)} className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors ${selectedMembers.includes(u.id) ? 'bg-indigo-600/20 border border-indigo-500' : 'hover:bg-gray-700 border border-transparent'}`}>
                   <Avatar name={u.name} src={u.avatar} avatarStyle={u.avatar_style} avatarSeed={u.avatar_seed} avatarOptions={u.avatar_options} size="sm" />
                   <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{u.name}</p><p className="text-xs text-gray-500">{u.role === 'admin' ? 'Team Leader' : 'Developer'}</p></div>
                   {selectedMembers.includes(u.id) && <i className="fa-solid fa-check text-indigo-400 text-sm"></i>}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
          <button onClick={handleCreate} disabled={!groupName.trim()} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm disabled:opacity-30">Create Group</button>
        </div>
      </div>
    </div>
  )
}

function GroupInfoPanel({ groupId, groupName, onClose, onLightbox }) {
  const [tab, setTab] = useState('members')
  const [members, setMembers] = useState([])
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const ref = useRef(null)
  useEffect(() => {
    setLoading(true)
    Promise.all([fetch(`/api/chat/group/${groupId}/members`).then(r => r.json()), fetch(`/api/chat/group/${groupId}/members?media=1`).then(r => r.json())])
      .then(([m, md]) => { setMembers(m.members || []); setMedia(md.media || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [groupId])
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div ref={ref} className="w-80 bg-gray-900 border-l border-gray-700 h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-bold text-white truncate">{groupName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="flex border-b border-gray-700">
          <button onClick={() => setTab('members')} className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === 'members' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-white'}`}><i className="fa-solid fa-users mr-1"></i> Members ({members.length})</button>
          <button onClick={() => setTab('media')} className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === 'media' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-white'}`}><i className="fa-solid fa-images mr-1"></i> Media ({media.length})</button>
        </div>
        <div className="p-3">
          {loading ? <div className="flex justify-center py-8"><i className="fa-solid fa-spinner fa-spin text-gray-500"></i></div>
            : tab === 'members' ? <div className="space-y-1">{members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors">
                <Avatar name={m.name} src={m.avatar} avatarStyle={m.avatar_style} avatarSeed={m.avatar_seed} avatarOptions={m.avatar_options} size="sm" />
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{m.name}</p><p className="text-[10px] text-gray-500">{m.role === 'admin' ? 'Team Leader' : 'Developer'}</p></div>
              </div>
            ))}</div>
            : <div className="grid grid-cols-3 gap-1">{media.length === 0 ? <p className="text-xs text-gray-500 text-center py-8 col-span-3">No media yet</p> : media.map(m => (
              <div key={m.id} className="aspect-square rounded-lg overflow-hidden cursor-pointer border border-gray-700 hover:border-indigo-500" onClick={() => { onLightbox(m.media_url); onClose() }}>
                <img src={m.media_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}</div>}
        </div>
      </div>
    </div>
  )
}

function ForwardModal({ onClose, onForward, conversations, groups }) {
  const [search, setSearch] = useState('')
  const filteredChats = [...conversations.map(c => ({ ...c, type: 'user' })), ...groups.map(g => ({ ...g, type: 'group' }))]
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Forward Message</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="p-3">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search chats..." className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm mb-2" autoFocus />
          <div className="max-h-60 overflow-y-auto">
            {filteredChats.map(c => (
              <button key={`${c.type}-${c.id}`} onClick={() => { onForward(c); onClose() }} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-gray-700 transition-colors text-left">
                {c.type === 'group' ? <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center"><i className="fa-solid fa-users text-indigo-400 text-xs"></i></div> : <Avatar name={c.name} src={c.avatar} avatarStyle={c.avatar_style} avatarSeed={c.avatar_seed} avatarOptions={c.avatar_options} size="sm" />}
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{c.name}</p><p className="text-[10px] text-gray-500">{c.type === 'group' ? 'Group' : 'Personal'}</p></div>
                <i className="fa-solid fa-share text-gray-600 text-xs"></i>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ReadByModal({ messageId, onClose }) {
  const [readers, setReaders] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/messages/${messageId}/read`).then(r => r.json()).then(d => { setReaders(d.readers || []); setLoading(false) }).catch(() => setLoading(false))
  }, [messageId])
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-xl w-full max-w-sm border border-gray-700 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-white">Read by</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
        </div>
        <div className="p-3 max-h-60 overflow-y-auto">
          {loading ? <div className="flex justify-center py-4"><i className="fa-solid fa-spinner fa-spin text-gray-500"></i></div>
            : readers.length === 0 ? <p className="text-xs text-gray-500 text-center py-4">No one has read this yet</p>
            : readers.map(r => (
              <div key={r.user_id} className="flex items-center gap-3 px-3 py-2 rounded-lg">
                <Avatar name={r.name} src={r.avatar} avatarStyle={r.avatar_style} avatarSeed={r.avatar_seed} avatarOptions={r.avatar_options} size="sm" />
                <div className="flex-1"><p className="text-sm font-medium text-white">{r.name}</p><p className="text-[10px] text-gray-500">{new Date(r.read_at).toLocaleString()}</p></div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { user, token } = useAuth()
  const [conversations, setConversations] = useState([])
  const [groups, setGroups] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [allProjects, setAllProjects] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [lightboxImg, setLightboxImg] = useState(null)
  const [chatTab, setChatTab] = useState('chats')
  const { socket, startCall, startGroupCall: ctxStartGroupCall, groupCallMembers, incomingGroupCall, callState, groupCallState } = useCall()
  const [typingUsers, setTypingUsers] = useState([])
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const [groupMembers, setGroupMembers] = useState([])
  const [messageSearch, setMessageSearch] = useState('')
  const [groupTypingUsers, setGroupTypingUsers] = useState([])
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionType, setMentionType] = useState('')
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0)
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const [replyTo, setReplyTo] = useState(null)
  const [editingMsg, setEditingMsg] = useState(null)
  const [editText, setEditText] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [showForwardModal, setShowForwardModal] = useState(null)
  const [showReadBy, setShowReadBy] = useState(null)
  const [pinnedMessages, setPinnedMessages] = useState([])
  const [showPinned, setShowPinned] = useState(false)
  const [messageReactions, setMessageReactions] = useState({})
  const [showReactionPicker, setShowReactionPicker] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordTime, setRecordTime] = useState(0)
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const textareaRef = useRef(null)
  const isNearBottomRef = useRef(true)
  const justOpenedChatRef = useRef(false)
  const typingTimeoutRef = useRef(null)
  const isTypingRef = useRef(false)
  const activeChatRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recordIntervalRef = useRef(null)
  activeChatRef.current = activeChat

  function showNotification(msg) {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || document.hasFocus()) return
      new Notification(msg.sender_name || 'New Message', { body: msg.message_type === 'image' ? '📷 Image' : msg.message_type === 'voice' ? '🎤 Voice message' : (msg.message || ''), icon: '/favicon-white.webp', tag: `chat-${msg.sender_id}` })
    } catch (e) {}
  }

  function scrollToBottom(smooth = true) { messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' }) }
  function handleScroll() {
    const el = messagesContainerRef.current
    if (el) isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150
  }

  function handleTyping() {
    if (!socket || !activeChat) return
    if (!isTypingRef.current) {
      isTypingRef.current = true
      if (activeChat.type === 'group') socket.emit('chat:group-typing', { groupId: activeChat.id, typing: true })
      else socket.emit('chat:typing', { receiverId: activeChat.id })
    }
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false
      if (activeChat.type === 'group') socket.emit('chat:group-typing', { groupId: activeChat.id, typing: false })
      else socket.emit('chat:stop-typing', { receiverId: activeChat.id })
    }, 2000)
  }

  const mentionCandidates = mentionType === '@'
    ? allUsers.filter(u => u.id !== user?.id && u.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : mentionType === '#' ? allProjects.filter(p => p.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6) : []

  function insertMention(item) {
    const val = inputMessage, trigger = mentionType, lastIdx = val.lastIndexOf(trigger)
    if (lastIdx === -1) { setShowMentionDropdown(false); return }
    const before = val.slice(0, lastIdx), after = val.slice(textareaRef.current?.selectionStart || val.length)
    const newVal = before + trigger + item.name + ' ' + after
    setInputMessage(newVal); setShowMentionDropdown(false); setMentionType(''); setMentionQuery('')
    setTimeout(() => { textareaRef.current?.focus(); const p = (before + trigger + item.name + ' ').length; textareaRef.current?.setSelectionRange(p, p) }, 0)
  }

  function handleInputChange(e) {
    const val = e.target.value
    setInputMessage(val); handleTyping()
    const textBefore = val.slice(0, e.target.selectionStart)
    const m = textBefore.match(/([@#])(\w*)$/)
    if (m && (activeChat?.type === 'group' || m[1] === '#')) {
      setMentionType(m[1]); setMentionQuery(m[2]); setShowMentionDropdown(true); setMentionSelectedIdx(0)
    } else setShowMentionDropdown(false)
  }

  function handleInputKeyDown(e) {
    if (showMentionDropdown && mentionCandidates.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionSelectedIdx(p => Math.min(p + 1, mentionCandidates.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionSelectedIdx(p => Math.max(p - 1, 0)); return }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); insertMention(mentionCandidates[mentionSelectedIdx]); return }
      if (e.key === 'Escape') { setShowMentionDropdown(false); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // Voice recording
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      let options = { mimeType: 'audio/webm;codecs=opus' }
      if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/mp4' }
        if (!MediaRecorder.isTypeSupported(options.mimeType)) options = {}
      }
      const mr = new MediaRecorder(stream, options)
      audioChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); sendVoiceMessage() }
      mediaRecorderRef.current = mr
      mr.start()
      setIsRecording(true); setRecordTime(0)
      recordIntervalRef.current = setInterval(() => setRecordTime(p => p + 1), 1000)
    } catch (err) { console.error('Recording error:', err) }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false); clearInterval(recordIntervalRef.current)
  }

  function cancelRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
      mediaRecorderRef.current = null
    }
    setIsRecording(false); audioChunksRef.current = []; clearInterval(recordIntervalRef.current)
  }

  async function sendVoiceMessage() {
    if (!audioChunksRef.current.length || !activeChat) return
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    const formData = new FormData()
    formData.append('audio', blob, `voice-${Date.now()}.webm`)
    try {
      const uploadRes = await fetch('/api/upload/voice', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Upload failed')
      const { url } = await uploadRes.json()
      if (activeChat.type === 'group') {
        const body = { message: '🎤 Voice message', messageType: 'voice', mediaUrl: url }
        const res = await csrfFetch(`/api/chat/group/${activeChat.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (res.ok) { const d = await res.json(); if (d.message) setMessages(prev => [...prev, d.message]) }
      } else if (socket) {
        socket.emit('chat:send', { receiverId: activeChat.id, message: '🎤 Voice message', messageType: 'voice', mediaUrl: url })
      } else {
        const body = { receiverId: activeChat.id, message: '🎤 Voice message', messageType: 'voice', mediaUrl: url }
        const res = await csrfFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (res.ok) { const d = await res.json(); if (d.message) setMessages(prev => [...prev, d.message]) }
      }
    } catch (err) { console.error('Voice send error:', err) }
    audioChunksRef.current = []
  }

  function formatRecordTime(s) { const m = Math.floor(s / 60).toString().padStart(2, '0'); const sec = (s % 60).toString().padStart(2, '0'); return `${m}:${sec}` }

  // Context menu
  function handleContextMenu(e, msg) {
    e.preventDefault()
    const isMe = msg.sender_id === user?.id
    const items = []
    if (!msg.is_deleted) {
      items.push({ label: 'Reply', icon: 'fa-reply', action: () => setReplyTo(msg) })
      if (msg.message_type === 'image' && msg.media_url) items.push({ label: 'Forward', icon: 'fa-share', action: () => setShowForwardModal(msg) })
      if (isMe) {
        if (!msg.is_deleted && msg.message_type === 'text') items.push({ label: 'Edit', icon: 'fa-pen', action: () => { setEditingMsg(msg); setEditText(msg.message) } })
        items.push({ label: 'Delete', icon: 'fa-trash', action: () => deleteMessage(msg.id), danger: true })
      }
      items.push({ label: msg.is_pinned ? 'Unpin' : 'Pin', icon: 'fa-thumbtack', action: () => togglePin(msg.id) })
      if (msg.message_type !== 'image') items.push({ label: 'Forward', icon: 'fa-share', action: () => setShowForwardModal(msg) })
    }
    setContextMenu({ x: e.clientX, y: e.clientY, items, msg })
  }

  async function deleteMessage(msgId) {
    if (!confirm('Delete this message?')) return
    try {
      await fetch(`/api/messages/${msgId}/edit`, { method: 'DELETE' })
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_deleted: 1, message: null, media_url: null } : m))
    } catch (err) { console.error('Delete error:', err) }
  }

  async function saveEdit() {
    if (!editingMsg || !editText.trim()) return
    try {
      const res = await csrfFetch(`/api/messages/${editingMsg.id}/edit`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: editText.trim() }) })
      if (res.ok) { const d = await res.json(); setMessages(prev => prev.map(m => m.id === editingMsg.id ? { ...m, message: d.message.message, is_edited: 1 } : m)) }
      setEditingMsg(null); setEditText('')
    } catch (err) { console.error('Edit error:', err) }
  }

  async function togglePin(msgId) {
    try {
      const res = await fetch(`/api/messages/${msgId}/pin`, { method: 'POST' })
      if (res.ok) { const d = await res.json(); setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_pinned: d.is_pinned } : m)) }
    } catch (err) { console.error('Pin error:', err) }
  }

  async function forwardMessage(target) {
    if (!showForwardModal) return
    const body = target.type === 'group' ? { targetGroupId: target.id } : { targetReceiverId: target.id }
    try {
      await fetch(`/api/messages/${showForwardModal.id}/forward`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } catch (err) { console.error('Forward error:', err) }
    setShowForwardModal(null)
  }

  async function toggleReaction(msgId, emoji) {
    try {
      const res = await fetch(`/api/messages/${msgId}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) })
      if (res.ok) { loadReactions(msgId); setShowReactionPicker(null) }
    } catch (err) { console.error('Reaction error:', err) }
  }

  async function loadReactions(msgId) {
    try {
      const res = await fetch(`/api/messages/${msgId}/reactions`)
      if (res.ok) { const d = await res.json(); setMessageReactions(prev => ({ ...prev, [msgId]: d.reactions || [] })) }
    } catch {}
  }

  // Chat-specific socket events (global socket from CallContext)
  useEffect(() => {
    if (!socket || !user) return
    socket.on('chat:message', (msg) => {
      const chat = activeChatRef.current
      if (chat && ((chat.type !== 'group' && (msg.sender_id === chat.id || (msg.sender_id === user?.id && msg.receiver_id === chat.id))) || (chat.type === 'group' && msg.group_id == chat.id))) {
        setMessages(prev => { if (prev.find(m => m.id === msg.id)) return prev; return [...prev, msg] })
        if (isNearBottomRef.current) setTimeout(() => scrollToBottom(), 50)
        if (msg.sender_id !== user?.id) socket.emit('chat:mark-read', { messageId: msg.id })
      }
      if (msg.sender_id !== user?.id) showNotification(msg)
      pollAll()
    })
    socket.on('chat:typing', (d) => { if (d.userId !== user?.id) setTypingUsers(p => d.typing ? [...new Set([...p, d.userId])] : p.filter(id => id !== d.userId)) })
    socket.on('chat:group-typing', (d) => { if (d.userId !== user?.id && activeChatRef.current?.type === 'group' && activeChatRef.current?.id == d.groupId) setGroupTypingUsers(p => d.typing ? [...new Set([...p, d.userId])] : p.filter(id => id !== d.userId)) })
    socket.on('chat:read-confirm', () => setMessages(prev => prev.map(m => ({ ...m, is_read: 1 }))))
    socket.on('user-online', (d) => setOnlineUsers(prev => { const next = new Set(prev); d.online ? next.add(d.userId) : next.delete(d.userId); return next }))
    try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission() } catch (e) {}
    return () => {
      socket.off('chat:message')
      socket.off('chat:typing')
      socket.off('chat:group-typing')
      socket.off('chat:read-confirm')
      socket.off('user-online')
    }
  }, [socket, user?.id])

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (!activeChat) { setMessages([]); setGroupMembers([]); return }
    justOpenedChatRef.current = true; isNearBottomRef.current = true
    setTypingUsers([]); setGroupTypingUsers([]); setMessageSearch(''); setShowMentionDropdown(false); setReplyTo(null); setEditingMsg(null); setContextMenu(null); setPinnedMessages([]); setMessageReactions({})
    loadMessages()
    if (activeChat.type !== 'group' && socket && activeChat.id) socket.emit('chat:read', { senderId: activeChat.id })
    if (activeChat.type === 'group' && socket && activeChat.id) socket.emit('chat:group-read', { groupId: activeChat.id })
    if (activeChat.type === 'group') {
      fetch(`/api/chat/group/${activeChat.id}/members`).then(r => r.json()).then(d => setGroupMembers(d.members || [])).catch(() => setGroupMembers([]))
    } else {
      setGroupMembers([])
    }
    const interval = setInterval(loadMessages, 3000)
    return () => clearInterval(interval)
  }, [activeChat?.id, activeChat?.type])

  useEffect(() => {
    if (justOpenedChatRef.current) { justOpenedChatRef.current = false; return }
    if (isNearBottomRef.current) scrollToBottom()
  }, [messages])

  useEffect(() => { pollAll(); const i = setInterval(pollAll, 10000); return () => clearInterval(i) }, [])
  useEffect(() => { return () => { clearTimeout(typingTimeoutRef.current); clearInterval(recordIntervalRef.current) } }, [])

  // Load pinned messages and reactions when chat changes
  useEffect(() => {
    if (!activeChat) return
    const pinned = messages.filter(m => m.is_pinned)
    setPinnedMessages(pinned)
    messages.filter(m => m.message_type === 'image' || !m.is_deleted).forEach(m => loadReactions(m.id))
  }, [messages, activeChat?.id])

  // Close context menu on click
  useEffect(() => {
    const h = () => setContextMenu(null)
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])

  async function loadData() {
    try {
      const [c, u, g, p] = await Promise.all([fetch('/api/chat'), fetch('/api/users'), fetch('/api/chat/groups'), fetch('/api/projects')])
      const [cd, ud, gd, pd] = await Promise.all([c.json(), u.json(), g.json(), p.json()])
      setConversations(cd.conversations || []); setAllUsers(ud.users || []); setGroups(gd.groups || []); setAllProjects(pd.projects || [])
    } catch (err) { console.error('Load data error:', err) }
    finally { setLoading(false) }
  }

  async function pollAll() {
    try {
      const [c, g] = await Promise.all([fetch('/api/chat'), fetch('/api/chat/groups')])
      if (c.ok) { const d = await c.json(); setConversations(d.conversations || []) }
      if (g.ok) { const d = await g.json(); setGroups(d.groups || []) }
    } catch {}
  }

  async function loadMessages() {
    if (!activeChat) return
    try {
      const url = activeChat.type === 'group' ? `/api/chat/group/${activeChat.id}` : `/api/chat/${activeChat.id}`
      const res = await fetch(url); const d = await res.json(); setMessages(d.messages || [])
    } catch {}
  }

  async function handlePaste(e) {
    const items = e.clipboardData?.items; if (!items || !activeChat) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault(); const blob = item.getAsFile(); if (!blob) continue; setSending(true)
        try {
          const file = new File([blob], blob.name || `paste-${Date.now()}.png`, { type: blob.type || 'image/png' })
          const compressed = await compressImage(file)
          const fd = new FormData(); fd.append('image', compressed, compressed.name || `paste-${Date.now()}.jpg`)
          const up = await fetch('/api/upload', { method: 'POST', body: fd }); if (!up.ok) throw new Error('Upload failed')
          const { url } = await up.json()
          if (activeChat.type === 'group') {
            const body = { message: '', messageType: 'image', mediaUrl: url }
            const sr = await csrfFetch(`/api/chat/group/${activeChat.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            if (sr.ok) { const sd = await sr.json(); if (sd.message) setMessages(p => [...p, sd.message]) }
          } else if (socket) {
            socket.emit('chat:send', { receiverId: activeChat.id, message: '', messageType: 'image', mediaUrl: url })
          } else {
            const body = { receiverId: activeChat.id, message: '', messageType: 'image', mediaUrl: url }
            const sr = await csrfFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            if (sr.ok) { const sd = await sr.json(); if (sd.message) setMessages(p => [...p, sd.message]) }
          }
        } catch (err) { console.error('Paste error:', err) }
        finally { setSending(false) }; return
      }
    }
  }

  async function handleImageSelect(e) {
    const file = e.target.files?.[0]; if (!file || !activeChat) return; setSending(true)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData(); fd.append('image', compressed)
      const up = await fetch('/api/upload', { method: 'POST', body: fd }); if (!up.ok) throw new Error('Upload failed')
      const { url } = await up.json()
      if (activeChat.type === 'group') {
        const body = { message: '', messageType: 'image', mediaUrl: url }
        const sr = await csrfFetch(`/api/chat/group/${activeChat.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (sr.ok) { const sd = await sr.json(); if (sd.message) setMessages(p => [...p, sd.message]) }
      } else if (socket) {
        socket.emit('chat:send', { receiverId: activeChat.id, message: '', messageType: 'image', mediaUrl: url })
      } else {
        const body = { receiverId: activeChat.id, message: '', messageType: 'image', mediaUrl: url }
        const sr = await csrfFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (sr.ok) { const sd = await sr.json(); if (sd.message) setMessages(p => [...p, sd.message]) }
      }
    } catch (err) { console.error('Image error:', err) }
    finally { setSending(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  async function sendMessage() {
    if (!inputMessage.trim() || !activeChat || sending) return
    setSending(true); const msgText = inputMessage.trim(); setInputMessage(''); setShowMentionDropdown(false)
    try {
      if (activeChat.type === 'group') {
        // Group: use HTTP API (no CSRF on group endpoint)
        const body = { message: msgText, replyTo: replyTo?.id }
        const res = await csrfFetch(`/api/chat/group/${activeChat.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (res.ok) { const d = await res.json(); if (d.message) setMessages(p => [...p, d.message]) }
      } else if (socket) {
        // Private: use WebSocket (bypasses CSRF)
        socket.emit('chat:send', { receiverId: activeChat.id, message: msgText })
      } else {
        // Fallback: HTTP API
        const body = { receiverId: activeChat.id, message: msgText, replyTo: replyTo?.id }
        const res = await csrfFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (res.ok) { const d = await res.json(); if (d.message) setMessages(p => [...p, d.message]) }
      }
    } catch (err) { setInputMessage(msgText) }
    finally {
      setSending(false); setReplyTo(null)
      if (isTypingRef.current) { isTypingRef.current = false; clearTimeout(typingTimeoutRef.current); if (activeChat.type === 'group') socket?.emit('chat:group-typing', { groupId: activeChat.id, typing: false }); else socket?.emit('chat:stop-typing', { receiverId: activeChat.id }) }
      isNearBottomRef.current = true; setTimeout(() => scrollToBottom(), 100)
    }
  }

  async function createGroup({ name, memberIds }) {
    try {
      const res = await csrfFetch('/api/chat/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, memberIds }) })
      if (res.ok) { const d = await res.json(); if (d.group) { setGroups(p => [{ ...d.group, member_count: memberIds.length + 1 }, ...p]); setActiveChat({ id: d.group.id, name: d.group.name, type: 'group' }); setChatTab('groups') } }
    } catch (err) { console.error('Create group error:', err) }
  }

  function startGroupCall(groupId, groupName, callType) {
    if (!socket) return
    if (!groupMembers.length) { console.warn('[GroupCall] No group members loaded'); return }
    const memberIds = groupMembers.map(m => m.user_id || m.id).filter(id => id !== user?.id)
    console.log('[GroupCall] Starting:', { groupId, groupName, callType, memberIds, groupMembers })
    ctxStartGroupCall(groupId, groupName, callType, memberIds)
  }

  function formatTime(d) { return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) }
  function formatDate(d) {
    const dt = new Date(d), now = new Date(), diff = now - dt
    if (diff < 86400000 && dt.getDate() === now.getDate()) return 'Today'
    if (diff < 172800000) return 'Yesterday'
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  function selectUser(u) { setActiveChat({ id: u.id, name: u.name, role: u.role, avatar: u.avatar, avatar_style: u.avatar_style, avatar_seed: u.avatar_seed, avatar_options: u.avatar_options, type: 'user' }); setShowNewChat(false); setSearchQuery('') }
  function selectGroup(g) { setActiveChat({ id: g.id, name: g.name, avatar: g.avatar, type: 'group' }); setChatTab('groups'); setSearchQuery('') }

  const filteredConversations = conversations.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const otherUsers = allUsers.filter(u => u.id !== user?.id && (!searchQuery || u.name.toLowerCase().includes(searchQuery.toLowerCase())))
  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0) + groups.reduce((s, g) => s + (g.unread_count || 0), 0)
  const filteredMessages = messageSearch.trim() ? messages.filter(m => (m.message || '').toLowerCase().includes(messageSearch.toLowerCase()) || (m.sender_name || '').toLowerCase().includes(messageSearch.toLowerCase())) : messages
  const displayTyping = activeChat?.type === 'group' ? groupTypingUsers : typingUsers
  const typingNames = displayTyping.map(id => { if (id === user?.id) return null; const u = allUsers.find(u => u.id === id); return u?.name || 'Someone' }).filter(Boolean)

  if (!user) return null

  return (
    <Layout>
      <div className="h-[calc(100vh-5rem)] flex overflow-hidden -m-4 sm:-m-6 lg:-m-8">
        {/* Left panel */}
        <div className={`${activeChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r border-gray-700 bg-gray-900 flex-shrink-0`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <div className="flex items-center gap-2"><i className="fa-solid fa-comments text-indigo-400 text-lg"></i><h2 className="text-lg font-bold text-white">Chat</h2>{totalUnread > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalUnread}</span>}</div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setShowCreateGroup(true); setShowNewChat(false) }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" title="Create group"><i className="fa-solid fa-users text-sm"></i></button>
              <button onClick={() => { setShowNewChat(!showNewChat); setShowCreateGroup(false) }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors" title="New chat"><i className={`fa-solid ${showNewChat ? 'fa-arrow-left' : 'fa-pen-to-square'} text-sm`}></i></button>
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="relative"><i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i><input type="text" placeholder={showNewChat ? 'Search users...' : 'Search...'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" /></div>
          </div>
          {!showNewChat && (
            <div className="flex px-3 gap-1 border-b border-gray-700">
              <button onClick={() => setChatTab('chats')} className={`flex-1 py-2 text-xs font-medium rounded-t-lg transition-colors ${chatTab === 'chats' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-white'}`}>Chats {conversations.length > 0 && <span className="text-[10px]">({conversations.length})</span>}</button>
              <button onClick={() => setChatTab('groups')} className={`flex-1 py-2 text-xs font-medium rounded-t-lg transition-colors ${chatTab === 'groups' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-500 hover:text-white'}`}>Groups {groups.length > 0 && <span className="text-[10px]">({groups.length})</span>}</button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {loading ? <div className="flex items-center justify-center py-12"><i className="fa-solid fa-spinner fa-spin text-gray-500 text-xl"></i></div>
              : showNewChat ? otherUsers.map(u => (
                <button key={u.id} onClick={() => selectUser(u)} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-800 transition-colors text-left">
                   <Avatar name={u.name} src={u.avatar} avatarStyle={u.avatar_style} avatarSeed={u.avatar_seed} avatarOptions={u.avatar_options} size="sm" />
                   <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{u.name}</p><p className="text-xs text-gray-500">{u.role === 'admin' ? 'Team Leader' : 'Developer'}</p></div>
                   <i className="fa-solid fa-chevron-right text-gray-600 text-xs"></i>
                </button>
              )) : chatTab === 'chats' ? (filteredConversations.length > 0 ? filteredConversations.map(c => (
                <button key={c.id} onClick={() => selectUser(c)} className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-800 transition-colors text-left border-b border-gray-800/50 ${activeChat?.id === c.id && activeChat?.type === 'user' ? 'bg-gray-800' : ''}`}>
                   <div className="relative"><Avatar name={c.name} src={c.avatar} avatarStyle={c.avatar_style} avatarSeed={c.avatar_seed} avatarOptions={c.avatar_options} size="sm" />{onlineUsers.has(c.id) && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between"><p className="text-sm font-medium text-white truncate">{c.name}</p><span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">{c.last_message_at ? formatTime(c.last_message_at) : ''}</span></div>
                    <div className="flex items-center justify-between mt-0.5"><p className="text-xs text-gray-500 truncate">{c.last_sender === user.id && <span className="text-gray-600">You: </span>}{c.last_message_type === 'image' ? '📷 Image' : c.last_message_type === 'voice' ? '🎤 Voice' : c.last_message}</p>{c.unread_count > 0 && <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0">{c.unread_count}</span>}</div>
                  </div>
                </button>
              )) : <div className="flex flex-col items-center justify-center py-12 text-gray-500"><i className="fa-solid fa-inbox text-3xl mb-3 text-gray-600"></i><p className="text-sm">No conversations yet</p></div>) : (filteredGroups.length > 0 ? filteredGroups.map(g => (
                <button key={g.id} onClick={() => selectGroup(g)} className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-800 transition-colors text-left border-b border-gray-800/50 ${activeChat?.id === g.id && activeChat?.type === 'group' ? 'bg-gray-800' : ''}`}>
                  <div className="w-9 h-9 rounded-full bg-indigo-600/20 flex items-center justify-center flex-shrink-0"><i className="fa-solid fa-users text-indigo-400 text-sm"></i></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between"><p className="text-sm font-medium text-white truncate">{g.name}</p><span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">{g.last_message_at ? formatTime(g.last_message_at) : ''}</span></div>
                    <div className="flex items-center justify-between mt-0.5"><p className="text-xs text-gray-500 truncate">{g.last_message_type === 'image' ? '📷 Image' : g.last_message_type === 'voice' ? '🎤 Voice' : (g.last_message || 'No messages yet')}</p>{g.unread_count > 0 && <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0">{g.unread_count}</span>}</div>
                  </div>
                </button>
              )) : <div className="flex flex-col items-center justify-center py-12 text-gray-500"><i className="fa-solid fa-users text-3xl mb-3 text-gray-600"></i><p className="text-sm">No groups yet</p><button onClick={() => setShowCreateGroup(true)} className="mt-2 text-xs text-indigo-400 hover:text-indigo-300">Create one</button></div>)}
          </div>
        </div>

        {/* Right panel */}
        <div className={`${activeChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-gray-900`}>
          {activeChat ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700 bg-gray-900 flex-shrink-0">
                <button onClick={() => setActiveChat(null)} className="md:hidden text-gray-400 hover:text-white p-1"><i className="fa-solid fa-arrow-left text-lg"></i></button>
                <button onClick={() => { if (activeChat.type === 'group') setShowGroupInfo(true) }} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  {activeChat.type === 'group' ? (
                    <div className="w-9 h-9 rounded-full bg-indigo-600/20 flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-users text-indigo-400 text-sm"></i>
                    </div>
                  ) : (
                    <div className="relative">
                       <Avatar name={activeChat.name} src={activeChat.avatar} avatarStyle={activeChat.avatar_style} avatarSeed={activeChat.avatar_seed} avatarOptions={activeChat.avatar_options} size="sm" />
                      {onlineUsers.has(activeChat.id) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white truncate">{activeChat.name}</p><p className="text-xs text-gray-500 truncate">{activeChat.type === 'group' ? 'Click to view info' : (onlineUsers.has(activeChat.id) ? 'Online' : (activeChat.role === 'admin' ? 'Team Leader' : 'Developer'))}</p></div>
                </button>
                {activeChat.type !== 'group' && callState === 'idle' && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => startCall(activeChat.id, activeChat.name, 'voice')} className="w-9 h-9 rounded-full bg-gray-700 hover:bg-green-600 flex items-center justify-center transition-colors" title="Voice call"><i className="fa-solid fa-phone text-white text-sm"></i></button>
                    <button onClick={() => startCall(activeChat.id, activeChat.name, 'video')} className="w-9 h-9 rounded-full bg-gray-700 hover:bg-indigo-600 flex items-center justify-center transition-colors" title="Video call"><i className="fa-solid fa-video text-white text-sm"></i></button>
                  </div>
                )}
                {activeChat.type === 'group' && groupCallState === 'idle' && groupMembers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => startGroupCall(activeChat.id, activeChat.name, 'voice')} className="w-9 h-9 rounded-full bg-gray-700 hover:bg-green-600 flex items-center justify-center transition-colors" title="Group voice call"><i className="fa-solid fa-phone text-white text-sm"></i></button>
                    <button onClick={() => startGroupCall(activeChat.id, activeChat.name, 'video')} className="w-9 h-9 rounded-full bg-gray-700 hover:bg-indigo-600 flex items-center justify-center transition-colors" title="Group video call"><i className="fa-solid fa-video text-white text-sm"></i></button>
                  </div>
                )}
                <button onClick={() => setMessageSearch(p => p ? '' : '__SHOW__')} className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${messageSearch ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`} title="Search messages"><i className="fa-solid fa-magnifying-glass text-sm"></i></button>
              </div>

              {/* Pinned messages bar */}
              {pinnedMessages.length > 0 && !showPinned && (
                <button onClick={() => setShowPinned(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600/10 border-b border-indigo-500/30 text-indigo-400 text-xs hover:bg-indigo-600/20 transition-colors flex-shrink-0">
                  <i className="fa-solid fa-thumbtack"></i><span className="font-medium">{pinnedMessages.length} pinned message(s)</span><i className="fa-solid fa-chevron-down ml-auto text-[10px]"></i>
                </button>
              )}
              {showPinned && pinnedMessages.length > 0 && (
                <div className="px-4 py-2 bg-indigo-600/10 border-b border-indigo-500/30 flex-shrink-0">
                  <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-medium text-indigo-400">PINNED MESSAGES</span><button onClick={() => setShowPinned(false)} className="text-indigo-400 hover:text-white"><i className="fa-solid fa-xmark text-xs"></i></button></div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {pinnedMessages.map(m => (
                      <div key={m.id} className="flex items-center gap-2 px-2 py-1 rounded bg-gray-800/50 text-xs">
                        <span className="text-indigo-400 font-medium">{m.sender_name}</span>
                        <span className="text-gray-400 truncate flex-1">{m.message}</span>
                        <span className="text-gray-600">{formatTime(m.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {messageSearch && (
                <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/50 flex-shrink-0">
                  <div className="relative"><i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs"></i><input type="text" autoFocus value={messageSearch === '__SHOW__' ? '' : messageSearch} onChange={e => setMessageSearch(e.target.value || '__SHOW__')} placeholder="Search in messages..." className="w-full pl-9 pr-8 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500" /><button onClick={() => setMessageSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><i className="fa-solid fa-xmark text-xs"></i></button></div>
                  {messageSearch && messageSearch !== '__SHOW__' && <p className="text-[10px] text-gray-500 mt-1">{filteredMessages.length} message(s) found</p>}
                </div>
              )}

              {typingNames.length > 0 && (
                <div className="px-4 py-1.5 border-b border-gray-700/50 bg-gray-800/30 flex-shrink-0"><p className="text-xs text-indigo-400"><i className="fa-solid fa-circle fa-fade text-[8px] mr-1.5"></i>{typingNames.length === 1 ? `${typingNames[0]} is typing...` : `${typingNames.join(', ')} are typing...`}</p></div>
              )}

              {/* Reply preview */}
              {replyTo && (
                <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center gap-3 flex-shrink-0">
                  <div className="w-0.5 h-8 bg-indigo-500 rounded-full flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-indigo-400 font-medium">Reply to {replyTo.sender_name}</p>
                    <p className="text-xs text-gray-400 truncate">{replyTo.message_type === 'image' ? '📷 Image' : replyTo.message}</p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="text-gray-500 hover:text-white"><i className="fa-solid fa-xmark text-xs"></i></button>
                </div>
              )}

              {/* Edit preview */}
              {editingMsg && (
                <div className="px-4 py-2 bg-yellow-600/10 border-b border-yellow-500/30 flex items-center gap-3 flex-shrink-0">
                  <div className="w-0.5 h-8 bg-yellow-500 rounded-full flex-shrink-0"></div>
                  <div className="flex-1 min-w-0"><p className="text-[10px] text-yellow-400 font-medium">Editing message</p></div>
                  <button onClick={() => { setEditingMsg(null); setEditText('') }} className="text-gray-500 hover:text-white"><i className="fa-solid fa-xmark text-xs"></i></button>
                </div>
              )}

              {/* Messages */}
              <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {filteredMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <i className="fa-solid fa-paper-plane text-3xl mb-3 text-gray-600"></i>
                    <p className="text-sm">{messageSearch ? 'No messages found' : `Start a conversation with ${activeChat.name}`}</p>
                    {!messageSearch && activeChat.type === 'group' && <p className="text-xs text-gray-600 mt-2">Type <span className="text-indigo-400">@</span> to mention, <span className="text-emerald-400">#</span> for project</p>}
                  </div>
                )}
                {filteredMessages.map((msg, idx) => {
                  const isMe = msg.sender_id === user.id
                  const showDate = idx === 0 || formatDate(msg.created_at) !== formatDate(filteredMessages[idx - 1].created_at)
                  const showSender = activeChat.type === 'group' && !isMe
                  const isImage = msg.message_type === 'image'
                  const isVoice = msg.message_type === 'voice'
                  const reactions = messageReactions[msg.id] || []
                  const replyMsg = msg.reply_to ? { message: msg.reply_message, sender_name: msg.reply_sender_name, type: msg.reply_message_type } : null
                  if (msg.is_deleted) return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[70%]"><div className="px-4 py-2 rounded-2xl text-sm italic text-gray-600 bg-gray-800/50 border border-gray-700/50 rounded-br-md">This message was deleted</div></div>
                    </div>
                  )
                  return (
                    <div key={msg.id} onContextMenu={(e) => handleContextMenu(e, msg)}>
                      {showDate && <div className="flex justify-center my-4"><span className="text-[10px] text-gray-500 bg-gray-800 px-3 py-1 rounded-full">{formatDate(msg.created_at)}</span></div>}
                      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[70%]">
                          {showSender && <p className="text-xs text-indigo-400 mb-1 ml-1">{msg.sender_name}</p>}

                          {/* Reply preview in bubble */}
                          {replyMsg && (
                            <div className={`px-3 py-1.5 mb-1 rounded-lg border-l-2 border-indigo-500 bg-gray-800/50 ${isMe ? 'rounded-br-md' : 'rounded-bl-md'}`}>
                              <p className="text-[10px] text-indigo-400 font-medium">{replyMsg.sender_name}</p>
                              <p className="text-[10px] text-gray-500 truncate">{replyMsg.type === 'image' ? '📷 Image' : replyMsg.message}</p>
                            </div>
                          )}

                          {isImage && msg.media_url ? (
                            <div className={`rounded-2xl overflow-hidden ${isMe ? 'rounded-br-md' : 'rounded-bl-md'} cursor-pointer`} onClick={() => setLightboxImg(msg.media_url)}>
                              <img src={msg.media_url} alt="Image" className="max-w-full max-h-80 object-cover border border-gray-700" loading="lazy" />
                            </div>
                          ) : isVoice && msg.media_url ? (
                            <div className={`px-4 py-3 rounded-2xl ${isMe ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-gray-800 text-gray-200 rounded-bl-md border border-gray-700'}`}>
                              <audio controls src={msg.media_url} className="w-64 h-8" style={{ filter: 'invert(1) hue-rotate(180deg)' }} />
                            </div>
                          ) : (
                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-gray-800 text-gray-200 rounded-bl-md border border-gray-700'}`}>
                              {editingMsg?.id === msg.id ? (
                                <div className="flex items-center gap-2">
                                  <input type="text" value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { setEditingMsg(null); setEditText('') } }} className="flex-1 bg-transparent border-b border-white/30 text-white text-sm outline-none" autoFocus />
                                  <button onClick={saveEdit} className="text-xs text-yellow-400 hover:text-yellow-300"><i className="fa-solid fa-check"></i></button>
                                </div>
                              ) : (
                                <span dangerouslySetInnerHTML={{ __html: parseMessage(msg.message, allUsers, allProjects) }} />
                              )}
                              {!!msg.is_edited && !editingMsg && <span className="text-[9px] opacity-50 ml-1">(edited)</span>}
                            </div>
                          )}

                          {/* Reactions */}
                          {reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {reactions.map(r => (
                                <button key={r.emoji} onClick={() => toggleReaction(msg.id, r.emoji)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${r.users.some(u => u.id === user?.id) ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'}`}>
                                  <span>{r.emoji}</span><span className="text-[10px]">{r.count}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : ''}`}>
                            <span className="text-[10px] text-gray-600">{formatTime(msg.created_at)}</span>
                            {isMe && !isVoice && activeChat.type !== 'group' && (
                              <button onClick={() => setShowReadBy(msg.id)} className="cursor-pointer">
                                <i className={`fa-solid ${msg.is_read ? 'fa-check-double text-indigo-400' : 'fa-check text-gray-600'} text-[10px]`}></i>
                              </button>
                            )}
                            {isMe && <i className="fa-solid fa-chevron-down text-gray-600 text-[8px] ml-0.5 cursor-pointer hover:text-gray-400" onClick={(e) => handleContextMenu(e, msg)}></i>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-gray-700 flex-shrink-0 relative">
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageSelect} className="hidden" />
                {showEmoji && <EmojiPicker onSelect={(emoji) => setInputMessage(p => p + emoji)} onClose={() => setShowEmoji(false)} />}

                {/* Mention dropdown */}
                {showMentionDropdown && mentionCandidates.length > 0 && (
                  <div className="absolute bottom-full left-4 right-4 mb-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                    <div className="px-3 py-2 border-b border-gray-700"><p className="text-[10px] text-gray-500 font-medium">{mentionType === '@' ? 'MENTION SOMEONE' : 'MENTION PROJECT'}</p></div>
                    {mentionType === '@' ? mentionCandidates.map((u, i) => (
                      <button key={u.id} onClick={() => insertMention(u)} className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors ${i === mentionSelectedIdx ? 'bg-indigo-600/20' : 'hover:bg-gray-700'}`}>
                         <Avatar name={u.name} src={u.avatar} avatarStyle={u.avatar_style} avatarSeed={u.avatar_seed} avatarOptions={u.avatar_options} size="sm" />
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{u.name}</p><p className="text-[10px] text-gray-500">{u.role === 'admin' ? 'Team Leader' : 'Developer'}</p></div>
                        <span className="text-[10px] text-indigo-400">@{u.name}</span>
                      </button>
                    )) : mentionCandidates.map((p, i) => (
                      <button key={p.id} onClick={() => insertMention(p)} className={`flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors ${i === mentionSelectedIdx ? 'bg-emerald-600/20' : 'hover:bg-gray-700'}`}>
                        <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center"><i className="fa-solid fa-folder text-emerald-400 text-xs"></i></div>
                        <div className="flex-1 min-w-0"><p className="text-sm font-medium text-white truncate">{p.name}</p><p className="text-[10px] text-gray-500 truncate">{p.description || 'No description'}</p></div>
                        <span className="text-[10px] text-emerald-400">#{p.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Recording indicator */}
                {isRecording && (
                  <div className="flex items-center gap-3 px-4 py-2 mb-2 bg-red-600/10 border border-red-500/30 rounded-xl">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-red-400 font-medium">Recording {formatRecordTime(recordTime)}</span>
                    <div className="flex-1"></div>
                    <button onClick={cancelRecording} className="text-xs text-gray-400 hover:text-white px-2 py-1">Cancel</button>
                    <button onClick={stopRecording} className="text-xs text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg">Send</button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <button onClick={() => fileInputRef.current?.click()} disabled={sending} className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white disabled:opacity-30 transition-colors flex-shrink-0 border border-gray-700" title="Send image"><i className="fa-solid fa-image text-sm"></i></button>
                  <button onClick={() => isRecording ? cancelRecording() : startRecording()} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors flex-shrink-0 border ${isRecording ? 'bg-red-600 border-red-500 text-white animate-pulse' : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-white'}`} title={isRecording ? 'Cancel recording' : 'Record voice'}>
                    <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'} text-sm`}></i>
                  </button>
                  <button onClick={() => setShowEmoji(!showEmoji)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors flex-shrink-0 border ${showEmoji ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400 hover:text-white'}`} title="Emoji"><i className="fa-solid fa-face-smile text-sm"></i></button>
                  <div className="flex-1 relative">
                    <textarea ref={textareaRef} value={inputMessage} onChange={handleInputChange} onKeyDown={handleInputKeyDown} onPaste={handlePaste} placeholder={activeChat?.type === 'group' ? 'Type @ to mention, # for project...' : 'Type a message...'} rows={1} className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 max-h-32" style={{ minHeight: '42px' }} onInput={e => { e.target.style.height = '42px'; e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px' }} />
                  </div>
                  <button onClick={editingMsg ? saveEdit : sendMessage} disabled={(!inputMessage.trim() && !editingMsg) || sending} className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0">
                    {sending ? <i className="fa-solid fa-spinner fa-spin text-white text-sm"></i> : editingMsg ? <i className="fa-solid fa-check text-white text-sm"></i> : <i className="fa-solid fa-paper-plane text-white text-sm"></i>}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-4"><i className="fa-solid fa-comments text-3xl text-gray-600"></i></div>
              <p className="text-lg font-medium text-gray-400">Select a conversation</p>
              <p className="text-sm text-gray-600 mt-1">Choose from existing chats or start a new one</p>
            </div>
          )}
        </div>

        {/* Context menu */}
        {contextMenu && (
          <div className="fixed z-[100]" style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: Math.min(contextMenu.y, window.innerHeight - (contextMenu.items.length * 40 + 16)) }}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[180px]" onClick={e => e.stopPropagation()}>
              {contextMenu.items.map((item, i) => (
                <button key={i} onClick={() => { item.action(); setContextMenu(null) }} className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors ${item.danger ? 'text-red-400 hover:bg-red-600/10' : 'text-gray-300 hover:bg-gray-700'}`}>
                  <i className={`fa-solid ${item.icon} text-xs w-4`}></i>{item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {lightboxImg && (
          <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxImg(null)}>
            <button className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300 z-10" onClick={() => setLightboxImg(null)}><i className="fa-solid fa-xmark"></i></button>
            <img src={lightboxImg} alt="Full size" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
          </div>
        )}

        {showCreateGroup && <CreateGroupModal users={allUsers} currentUser={user} onClose={() => setShowCreateGroup(false)} onCreate={createGroup} />}
        {showGroupInfo && activeChat?.type === 'group' && <GroupInfoPanel groupId={activeChat.id} groupName={activeChat.name} onClose={() => setShowGroupInfo(false)} onLightbox={setLightboxImg} />}
        {showForwardModal && <ForwardModal onClose={() => setShowForwardModal(null)} onForward={forwardMessage} conversations={conversations} groups={groups} />}
        {showReadBy && <ReadByModal messageId={showReadBy} onClose={() => setShowReadBy(null)} />}
      </div>
    </Layout>
  )
}
