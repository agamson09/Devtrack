export async function exportToPDF(elementId, filename = 'export.pdf') {
  const html2pdf = (await import('html2pdf.js')).default
  const element = document.getElementById(elementId)
  if (!element) {
    console.error('Element not found:', elementId)
    return
  }

  const opt = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      backgroundColor: '#111827',
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
  }

  try {
    await html2pdf().set(opt).from(element).save()
  } catch (err) {
    console.error('PDF export error:', err)
  }
}

export function PdfExportButton({ elementId, filename, label }) {
  return (
    <button
      onClick={() => exportToPDF(elementId, filename)}
      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm font-medium transition-colors"
    >
      <i className="fa-solid fa-file-pdf mr-1"></i> {label || 'Export PDF'}
    </button>
  )
}
