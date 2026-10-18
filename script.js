import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.4.299/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.4.299/pdf.worker.min.mjs';

let selectedFiles = [];
let draggedFile = null;

const body = document;
const fileList = document.getElementById('fileList');
const dropZone = document.getElementById('dropZone');
const sortButton = document.getElementById('sortButton');
const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const input = document.createElement('input');
input.type = 'file';
input.multiple = true;
input.accept = 'application/pdf';

input.addEventListener('change', () => {
    handleFiles(Array.from(input.files));
    input.value = '';
});
dropZone.addEventListener('click', () => input.click());
body.addEventListener('dragover', (e) => e.preventDefault());
body.addEventListener('drop', (e) => {
    e.preventDefault();
    handleFiles(Array.from(e.dataTransfer.files));
});

function handleFiles(newFiles) {
    for (const file of newFiles) {
        if (!file || typeof file.name !== 'string' || !file.name.trim() || file.size === 0 ||
            (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name))) {
            continue;
        }
        if (!selectedFiles.some(existingFile => existingFile.name === file.name)) {
            selectedFiles.push(file);
        }
    }
    updateFileList();
}

sortButton.addEventListener('click', () => {
    selectedFiles.sort((a, b) => nameCollator.compare(a.name, b.name));
    updateFileList();
});

function updateFileList() {
    fileList.innerHTML = '';
    sortButton.disabled = selectedFiles.length < 2;
    selectedFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.textContent = file.name;
        li.draggable = true;
        li.addEventListener('dragstart', (e) => {
            draggedFile = file;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', file.name);
        });
        li.addEventListener('dragend', () => { draggedFile = null; });
        li.addEventListener('dragover', (e) => { e.preventDefault(); });
        li.addEventListener('drop', (e) => {
            e.preventDefault();
            // External file drops belong to the document's file intake handler.
            if (e.dataTransfer.files.length > 0) return;
            e.stopPropagation();
            const draggedIndex = selectedFiles.indexOf(draggedFile);
            draggedFile = null;
            if (draggedIndex < 0 || draggedIndex === index) return;
            const targetIndex = index;
            [selectedFiles[targetIndex], selectedFiles[draggedIndex]] = [selectedFiles[draggedIndex], selectedFiles[targetIndex]];
            updateFileList();
        });
        fileList.appendChild(li);
    });
}

document.getElementById('mergeButton').addEventListener('click', mergePdfs);

async function mergePdfs() {
    const { PDFDocument } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    for (const file of selectedFiles) {
        const arrayBuffer = await file.arrayBuffer();

        let pdfDoc;
        let imported = false;

        try {
            pdfDoc = await PDFDocument.load(arrayBuffer);
            const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
            imported = true;
        } catch (error) {
            console.warn(`Direct import failed for ${file.name}, falling back to image rendering.`);
        }

        if (!imported) {
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 2.0 });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({ canvasContext: context, viewport }).promise;

                const imgData = canvas.toDataURL('image/png');
                const imgBytes = await fetch(imgData).then(res => res.arrayBuffer());
                const img = await mergedPdf.embedPng(imgBytes);

                const newPage = mergedPdf.addPage([viewport.width, viewport.height]);
                newPage.drawImage(img, {
                    x: 0,
                    y: 0,
                    width: viewport.width,
                    height: viewport.height
                });
            }
        }
    }

    const mergedPdfBytes = await mergedPdf.save();
    const timestamp = new Date().toISOString().replace(/[:-]/g, '').replace('T', '-').replace(/\..+/, '');
    const userFileName = document.getElementById('fileName').value.trim();
    const finalFileName = userFileName || `merged-${timestamp}.pdf`;

    downloadBlob(mergedPdfBytes, finalFileName, "application/pdf");
}

function downloadBlob(blob, filename, mimeType) {
    const blobUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
}
