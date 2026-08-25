const statusConfig = {
  todo: { label: 'To Do', bg: 'bg-gray-600', text: 'text-gray-100' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-600', text: 'text-blue-100' },
  review: { label: 'In Review', bg: 'bg-yellow-600', text: 'text-yellow-100' },
  done: { label: 'Done', bg: 'bg-green-600', text: 'text-green-100' },
}

const priorityConfig = {
  low: { label: 'Low', bg: 'bg-gray-600', text: 'text-gray-100' },
  medium: { label: 'Medium', bg: 'bg-blue-600', text: 'text-blue-100' },
  high: { label: 'High', bg: 'bg-orange-600', text: 'text-orange-100' },
  urgent: { label: 'Urgent', bg: 'bg-red-600', text: 'text-red-100' },
}

export function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.todo

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

export function PriorityBadge({ priority }) {
  const config = priorityConfig[priority] || priorityConfig.low

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}

export default function Badge({ type, value }) {
  if (type === 'status') return <StatusBadge status={value} />
  if (type === 'priority') return <PriorityBadge priority={value} />
  return null
}
