export type ReportRow = {
  description: string
  counterparty: string
  amount: string
}

export type PdfReport = {
  content: string[]
}

export function buildPdfReport(groupName: string, rows: ReportRow[]): PdfReport {
  return {
    content: [
      'MoneySplitter',
      groupName,
      'Bills',
      ...rows.flatMap((row) => [row.description, row.counterparty, row.amount]),
    ],
  }
}

export async function downloadPdfReport(groupName: string, rows: ReportRow[]): Promise<void> {
  const [pdfmakeModule, pdfFontsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ])
  const pdfmake = pdfmakeModule.default
  pdfmake.addVirtualFileSystem(pdfFontsModule.default)
  pdfmake.createPdf(buildPdfReport(groupName, rows)).download(`${groupName}.pdf`)
}
