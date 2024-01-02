let selectedFiles = [];

const fileList = document.getElementById('fileList');
const dropZone = document.getElementById('dropZone');
const input = document.createElement('input');
input.type = 'file';
input.multiple = true;
input.accept = 'application/pdf';

input.addEventListener('change', () => handleFiles(Array.from(input.files)));
dropZone.addEventListener('click', () => input.click());
dropZone.addEventListener('dragover', (e) => e.preventDefault());
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    handleFiles(Array.from(e.dataTransfer.files));
});

function handleFiles(newFiles) {
    selectedFiles = selectedFiles.concat(newFiles.filter(newFile =>
        !selectedFiles.some(existingFile => existingFile.name === newFile.name)));
    updateFileList();
}

function updateFileList() {
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const li = document.createElement('li');
        li.textContent = file.name;
        li.draggable = true;
        li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', index); });
        li.addEventListener('dragover', (e) => { e.preventDefault(); });
        li.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedIndex = e.dataTransfer.getData('text/plain');
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
        const pdf = await PDFDocument.load(arrayBuffer);
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedPdfBytes = await mergedPdf.save();
    const timestamp = new Date().toISOString().replace(/[:-]/g, '').replace('T', '-').replace(/\..+/, '');
    const userFileName = document.getElementById('fileName').value.trim();
    const defaultFileName = `merged-${timestamp}.pdf`;
    const finalFileName = userFileName || defaultFileName;

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
