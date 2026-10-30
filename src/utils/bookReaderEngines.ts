import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'
import { setGlobalEpubCfi } from './epubMarkAnchors'

export type PdfEngineModule = {
  getDocument: typeof import('pdfjs-dist/legacy/build/pdf.mjs').getDocument
  TextLayer: typeof import('pdfjs-dist/legacy/build/pdf.mjs').TextLayer
  GlobalWorkerOptions: typeof import('pdfjs-dist/legacy/build/pdf.mjs').GlobalWorkerOptions
}

export type EpubEngineModule = {
  ePub: typeof import('epubjs').default
  EpubCFI: typeof import('epubjs').EpubCFI
}

let pdfEnginePromise: Promise<PdfEngineModule> | null = null
let epubEnginePromise: Promise<EpubEngineModule> | null = null

export function loadPdfEngine(): Promise<PdfEngineModule> {
  if (!pdfEnginePromise) {
    if (typeof document !== 'undefined') {
      void import('pdfjs-dist/web/pdf_viewer.css').catch(() => {})
    }
    pdfEnginePromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfModule) => {
      const getDocument = pdfModule.getDocument
      let TextLayer: any = undefined
      try {
        TextLayer = (pdfModule as any).TextLayer
      } catch {}
      let GlobalWorkerOptions: any = undefined
      try {
        GlobalWorkerOptions = (pdfModule as any).GlobalWorkerOptions
      } catch {}
      if (GlobalWorkerOptions && pdfWorker) {
        GlobalWorkerOptions.workerSrc = pdfWorker
      }
      return { getDocument, TextLayer, GlobalWorkerOptions }
    })
  }
  return pdfEnginePromise
}

export function loadEpubEngine(): Promise<EpubEngineModule> {
  if (!epubEnginePromise) {
    epubEnginePromise = import('epubjs').then((m) => {
      const ePub = (typeof m.default === 'function' ? m.default : (m.default as any)?.default || m) as typeof import('epubjs').default
      let EpubCFI: any = undefined
      try {
        EpubCFI = (m as any).EpubCFI || (m.default as any)?.EpubCFI
      } catch {}
      if (EpubCFI) {
        setGlobalEpubCfi(EpubCFI)
      }
      return { ePub, EpubCFI }
    })
  }
  return epubEnginePromise
}

export function resetReaderEnginesForTest() {
  pdfEnginePromise = null
  epubEnginePromise = null
  setGlobalEpubCfi(null)
}
