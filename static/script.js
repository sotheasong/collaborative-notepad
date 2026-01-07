// Global state
let currentFileName = null;
let dialogMode = 'open'; // 'open' or 'save'

// DOM elements
const textEditor = document.getElementById('textEditor');
const lineNumbers = document.getElementById('lineNumbers');
const filenameDisplay = document.getElementById('filenameDisplay');
const fileDialog = document.getElementById('fileDialog');
const saveDialog = document.getElementById('saveDialog');
const overwriteDialog = document.getElementById('overwriteDialog');
const fileList = document.getElementById('fileList');
const fileNameInput = document.getElementById('fileNameInput');
const saveFileNameInput = document.getElementById('saveFileNameInput');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupMenuBar();
    setupEditor();
    updateLineNumbers();
});

// Menu bar setup
function setupMenuBar() {
    const fileMenuBtn = document.getElementById('fileMenuBtn');
    const editMenuBtn = document.getElementById('editMenuBtn');
    const fileMenu = document.getElementById('fileMenu');
    const editMenu = document.getElementById('editMenu');

    fileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu(fileMenu);
        editMenu.classList.remove('show');
    });

    editMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu(editMenu);
        fileMenu.classList.remove('show');
    });

    document.addEventListener('click', () => {
        fileMenu.classList.remove('show');
        editMenu.classList.remove('show');
    });
}

function toggleMenu(menu) {
    menu.classList.toggle('show');
}

// Editor setup
function setupEditor() {
    // Update line numbers on input
    textEditor.addEventListener('input', updateLineNumbers);
    textEditor.addEventListener('scroll', syncScroll);
    
    // Update on paste (with slight delay to ensure content is inserted)
    textEditor.addEventListener('paste', () => {
        setTimeout(updateLineNumbers, 0);
    });
    
    // Sync line number scroll with editor scroll
    lineNumbers.addEventListener('scroll', syncLineNumberScroll);
    
    // Handle tab key
    textEditor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textEditor.selectionStart;
            const end = textEditor.selectionEnd;
            textEditor.value = textEditor.value.substring(0, start) + '    ' + textEditor.value.substring(end);
            textEditor.selectionStart = textEditor.selectionEnd = start + 4;
            updateLineNumbers();
        }
    });
}

// Line number synchronization
function updateLineNumbers() {
    const lines = textEditor.value.split('\n');
    const lineCount = lines.length;
    
    // Generate line numbers
    const lineNumbersHTML = Array.from({ length: lineCount }, (_, i) => i + 1)
        .map(num => `<div>${num}</div>`)
        .join('');
    
    lineNumbers.innerHTML = lineNumbersHTML;
    
    // Ensure line numbers height matches editor content
    syncLineHeight();
}

function syncLineHeight() {
    // Match scroll height of line numbers with editor
    const editorHeight = textEditor.scrollHeight;
    lineNumbers.style.height = `${editorHeight}px`;
}

function syncScroll() {
    // Sync line numbers scroll with editor scroll
    lineNumbers.scrollTop = textEditor.scrollTop;
}

function syncLineNumberScroll() {
    // Sync editor scroll with line numbers scroll
    textEditor.scrollTop = lineNumbers.scrollTop;
}

// File operations
function newFile() {
    if (confirm('Create a new file? Unsaved changes will be lost.')) {
        textEditor.value = '';
        currentFileName = null;
        filenameDisplay.textContent = 'Untitled';
        updateLineNumbers();
    }
}

async function openFile() {
    dialogMode = 'open';
    document.getElementById('dialogTitle').textContent = 'Open File';
    document.getElementById('dialogActionBtn').textContent = 'Open';
    
    try {
        const response = await fetch('/api/files');
        const data = await response.json();
        
        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }
        
        displayFileList(data.files);
        fileDialog.classList.add('show');
    } catch (error) {
        alert('Error loading files: ' + error.message);
    }
}

function displayFileList(files) {
    if (files.length === 0) {
        fileList.innerHTML = '<div style="padding: 10px; color: #999;">No files found</div>';
        return;
    }
    
    fileList.innerHTML = files.map(file => 
        `<div class="file-list-item" onclick="selectFile('${file}')">${file}</div>`
    ).join('');
}

function selectFile(filename) {
    fileNameInput.value = filename;
}

async function dialogAction() {
    const filename = fileNameInput.value.trim();
    if (!filename) {
        alert('Please enter a file name');
        return;
    }
    
    if (dialogMode === 'open') {
        await loadFile(filename);
        closeFileDialog();
    }
}

async function loadFile(filename) {
    try {
        const response = await fetch(`/api/files/${encodeURIComponent(filename)}`);
        const data = await response.json();
        
        if (data.error) {
            alert('Error: ' + data.error);
            return;
        }
        
        textEditor.value = data.content || '';
        currentFileName = data.file_name;
        filenameDisplay.textContent = currentFileName;
        updateLineNumbers();
    } catch (error) {
        alert('Error loading file: ' + error.message);
    }
}

function closeFileDialog() {
    fileDialog.classList.remove('show');
    fileNameInput.value = '';
}

function saveFile() {
    if (currentFileName) {
        // Save existing file
        saveCurrentFile();
    } else {
        // Open save dialog
        saveDialog.classList.add('show');
        saveFileNameInput.value = 'untitled.txt';
        saveFileNameInput.focus();
        saveFileNameInput.select();
    }
}

async function confirmSave() {
    const filename = saveFileNameInput.value.trim();
    if (!filename) {
        alert('Please enter a file name');
        return;
    }
    
    closeSaveDialog();
    await saveFileWithName(filename);
}

function closeSaveDialog() {
    saveDialog.classList.remove('show');
    saveFileNameInput.value = '';
}

async function saveFileWithName(filename) {
    const content = textEditor.value;
    
    try {
        const response = await fetch('/api/files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file_name: filename,
                content: content
            })
        });
        
        const data = await response.json();
        
        if (response.status === 409) {
            // File exists - show overwrite dialog
            document.getElementById('overwriteFileName').textContent = filename;
            overwriteDialog.classList.add('show');
            pendingFileName = filename;
        } else if (data.error) {
            alert('Error: ' + data.error);
        } else {
            currentFileName = data.file_name;
            filenameDisplay.textContent = currentFileName;
            alert('File saved successfully!');
        }
    } catch (error) {
        alert('Error saving file: ' + error.message);
    }
}

let pendingFileName = null;

async function confirmOverwrite() {
    if (!pendingFileName) return;
    
    const content = textEditor.value;
    
    try {
        const response = await fetch(`/api/files/${encodeURIComponent(pendingFileName)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            currentFileName = pendingFileName;
            filenameDisplay.textContent = currentFileName;
            alert('File overwritten successfully!');
        }
        
        closeOverwriteDialog();
        pendingFileName = null;
    } catch (error) {
        alert('Error overwriting file: ' + error.message);
    }
}

async function createDuplicate() {
    if (!pendingFileName) return;
    
    const content = textEditor.value;
    
    try {
        const response = await fetch('/api/files/duplicate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file_name: pendingFileName,
                content: content
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            currentFileName = data.file_name;
            filenameDisplay.textContent = currentFileName;
            alert('Duplicate created: ' + data.file_name);
        }
        
        closeOverwriteDialog();
        pendingFileName = null;
    } catch (error) {
        alert('Error creating duplicate: ' + error.message);
    }
}

function closeOverwriteDialog() {
    overwriteDialog.classList.remove('show');
    pendingFileName = null;
}

async function saveCurrentFile() {
    if (!currentFileName) {
        saveFile();
        return;
    }
    
    const content = textEditor.value;
    
    try {
        const response = await fetch(`/api/files/${encodeURIComponent(currentFileName)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            alert('Error: ' + data.error);
        } else {
            alert('File saved successfully!');
        }
    } catch (error) {
        alert('Error saving file: ' + error.message);
    }
}

// Edit operations
function cutText() {
    textEditor.focus();
    document.execCommand('cut');
    updateLineNumbers();
}

function copyText() {
    textEditor.focus();
    document.execCommand('copy');
}

function pasteText() {
    textEditor.focus();
    document.execCommand('paste');
    updateLineNumbers();
}

function undoEdit() {
    textEditor.focus();
    document.execCommand('undo');
    updateLineNumbers();
}

function redoEdit() {
    textEditor.focus();
    document.execCommand('redo');
    updateLineNumbers();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+S or Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
    }
    
    // Ctrl+O or Cmd+O to open
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        openFile();
    }
    
    // Ctrl+N or Cmd+N to new
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        newFile();
    }
});

// Handle dialog Enter key
fileNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        dialogAction();
    }
});

saveFileNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        confirmSave();
    }
});

