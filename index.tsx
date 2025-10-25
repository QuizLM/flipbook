import { GoogleGenAI } from "@google/genai";
import { dom } from './js/dom.js';
import { showLoader, showError, showFlipbook, updateLoaderProgress, resetView, switchTab } from './js/ui.js';
import { processFile } from './js/content.js';
import { createFlipbook, flipPrevPage, flipNextPage, paginateHtmlContent, getFlipbookInstance, getSearchablePages, flipToPage } from './js/flipbook.js';
import { initTts } from './js/tts.js';

// FIX: Add declaration for 'marked' to resolve "Cannot find name 'marked'" error.
declare var marked: any;

// --- State Management ---
let currentContentSource: { type: 'file' | 'text' | null, value: File | string | null } = { type: null, value: null }; // type: 'file' or 'text'
let searchablePages: string[] = [];

// --- Main App Logic ---

async function handleGenerate() {
    if (!currentContentSource.value) {
        showError("No content source selected. Please upload a file or paste text.");
        return;
    }
    
    showLoader();
    dom.fileNameDisplay.textContent = '';
    
    try {
        // FIX: Cast dom.coverImageInput to HTMLInputElement to access 'files' property.
        const coverImageInput = (dom.coverImageInput as HTMLInputElement).files?.[0];
        const coverImageBase64 = coverImageInput ? await fileToBase64(coverImageInput) : null;

        const options = {
            // FIX: Cast querySelector result to HTMLElement to access 'dataset' property.
            theme: (document.querySelector('.theme-btn.active') as HTMLElement)?.dataset.theme || 'default',
            // FIX: Cast dom.narrationToggle to HTMLInputElement to access 'checked' property.
            narration: (dom.narrationToggle as HTMLInputElement).checked,
            cover: {
                // FIX: Cast dom.coverTitle to HTMLInputElement to access 'value' property.
                title: (dom.coverTitle as HTMLInputElement).value,
                // FIX: Cast dom.coverAuthor to HTMLInputElement to access 'value' property.
                author: (dom.coverAuthor as HTMLInputElement).value,
                image: coverImageBase64,
            }
        };

        let content;
        if (currentContentSource.type === 'text') {
            updateLoaderProgress(50);
            content = await Promise.resolve(currentContentSource.value);
            updateLoaderProgress(90);

        } else { // It's a file
            const onProgress = (percentage: number) => updateLoaderProgress(percentage);
            content = await processFile(currentContentSource.value as File, onProgress);
        }
        
        updateLoaderProgress(95);

        // Configure marked to open links in a new tab
        const renderer = new marked.Renderer();
        renderer.link = (href: string, title: string, text: string) => `<a target="_blank" rel="noopener" href="${href}" title="${title || ''}">${text}</a>`;
        marked.use({ renderer });

        let pages;
        if (Array.isArray(content)) {
            pages = content;
        } else if (typeof content === 'string') {
            const fullHtml = marked.parse(content, { breaks: true });
            pages = paginateHtmlContent(fullHtml);
        } else {
            throw new Error('Unsupported content type for flipbook generation.');
        }
        
        searchablePages = getSearchablePages(pages, Array.isArray(content));
        
        setTimeout(() => {
            createFlipbook(pages, options);
            updateLoaderProgress(100);
        }, 100);

    } catch (error: any) {
        showError(error.message || 'An unknown error occurred.');
    }
}

// --- Search Logic ---
function performSearch() {
    // FIX: Cast dom.searchInput to HTMLInputElement to access 'value' property.
    const query = (dom.searchInput as HTMLInputElement).value.trim().toLowerCase();
    if (!query) {
        dom.searchResults.classList.add('hidden');
        return;
    }
    
    const results: number[] = [];
    searchablePages.forEach((pageText, index) => {
        if (pageText.toLowerCase().includes(query)) {
            results.push(index);
        }
    });
    
    displaySearchResults(results);
}

function displaySearchResults(results: number[]) {
    dom.searchResults.innerHTML = '';
    if (results.length === 0) {
        dom.searchResults.innerHTML = '<p>No results found.</p>';
    } else {
        results.forEach(pageIndex => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.textContent = `Page ${pageIndex + 1}`;
            item.addEventListener('click', () => {
                flipToPage(pageIndex);
                dom.searchResults.classList.add('hidden');
                // FIX: Cast dom.searchInput to HTMLInputElement to access 'value' property.
                (dom.searchInput as HTMLInputElement).value = '';
            });
            dom.searchResults.appendChild(item);
        });
    }
    dom.searchResults.classList.remove('hidden');
}


// --- UI Effects ---

function addSparkleEffect(button: HTMLElement) {
    button.addEventListener('mousemove', (e: MouseEvent) => {
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        button.style.setProperty('--x', `${x}px`);
        button.style.setProperty('--y', `${y}px`);
    });
}

// --- Helpers ---
function fileToBase64(file: File): Promise<string | ArrayBuffer | null> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function updateGenerateButtonState() {
    // FIX: Cast dom.generateBtn to HTMLButtonElement to access 'disabled' property.
    (dom.generateBtn as HTMLButtonElement).disabled = !currentContentSource.value;
}

// --- Keyboard Navigation ---

function handleTabKeydown(e: KeyboardEvent) {
    const tabs = [dom.fileTabBtn, dom.textTabBtn];
    const activeIndex = tabs.findIndex(tab => tab === document.activeElement);
    if (activeIndex === -1) return;
    let newIndex = -1;
    if (e.key === 'ArrowRight') newIndex = (activeIndex + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') newIndex = (activeIndex - 1 + tabs.length) % tabs.length;
    if (newIndex !== -1) {
        e.preventDefault();
        const newTab = tabs[newIndex] as HTMLElement;
        switchTab(newTab.dataset.mode!);
        newTab.focus();
    }
}

// --- Full Screen Mode ---

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        dom.appContainer.requestFullscreen().catch(err => {
            alert(`Full-screen mode could not be activated: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

function handleFullScreenChange() {
    const isFullScreen = !!document.fullscreenElement;
    document.body.classList.toggle('fullscreen-active', isFullScreen);
    dom.enterFullscreenIcon.classList.toggle('hidden', isFullScreen);
    dom.exitFullscreenIcon.classList.toggle('hidden', !isFullScreen);
    dom.fullscreenBtn.setAttribute('aria-label', isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen');
    setTimeout(() => getFlipbookInstance()?.update(), 150);
}

// --- Event Listeners Setup ---

function initEventListeners() {
    // Tab switching
    dom.fileTabBtn.addEventListener('click', () => switchTab('file'));
    dom.textTabBtn.addEventListener('click', () => switchTab('text'));
    dom.tabsContainer.addEventListener('keydown', handleTabKeydown);

    // File input
    dom.dropzoneInput.addEventListener('change', (event) => {
        // FIX: Cast event.target to HTMLInputElement to access 'files' property.
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;
        dom.fileNameDisplay.textContent = `Selected: ${file.name}`;
        currentContentSource = { type: 'file', value: file };
        updateGenerateButtonState();
        // FIX: Cast event.target to HTMLInputElement to access 'value' property.
        target.value = ''; // Reset for same-file upload
    });
    
    // Drag and Drop
    const dropzone = dom.dropzoneLabel;
    dropzone.addEventListener('dragover', (e: DragEvent) => { e.preventDefault(); dropzone.classList.add('dragging'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
    dropzone.addEventListener('drop', (e: Event) => {
        e.preventDefault();
        dropzone.classList.remove('dragging');
        // FIX: Cast event 'e' to DragEvent to access 'dataTransfer' property.
        const file = (e as DragEvent).dataTransfer?.files?.[0];
        if (!file) return;
        dom.fileNameDisplay.textContent = `Selected: ${file.name}`;
        currentContentSource = { type: 'file', value: file };
        updateGenerateButtonState();
    });

    // Text input
    dom.textInput.addEventListener('input', () => {
        // FIX: Cast dom.textInput to HTMLTextAreaElement to access 'value' property.
        const text = (dom.textInput as HTMLTextAreaElement).value.trim();
        // FIX: Cast dom.textInput to HTMLTextAreaElement to access 'value' property.
        currentContentSource = text ? { type: 'text', value: (dom.textInput as HTMLTextAreaElement).value } : { type: null, value: null };
        updateGenerateButtonState();
    });
    
    // Customization
    dom.themeSelector.addEventListener('click', (e) => {
        // FIX: Cast e.target to HTMLElement to access 'classList' property.
        const target = e.target as HTMLElement;
        if (target.classList.contains('theme-btn')) {
            dom.themeSelector.querySelector('.active')?.classList.remove('active');
            // FIX: Cast e.target to HTMLElement to access 'classList' property.
            target.classList.add('active');
        }
    });

    dom.coverImageInput.addEventListener('change', () => {
        // FIX: Cast dom.coverImageInput to HTMLInputElement to access 'files' property.
        const file = (dom.coverImageInput as HTMLInputElement).files?.[0];
        dom.coverImageName.textContent = file ? file.name : '';
    });

    // Generate Button
    dom.generateBtn.addEventListener('click', handleGenerate);

    // Flipbook controls
    dom.prevPageBtn.addEventListener('click', flipPrevPage);
    dom.nextPageBtn.addEventListener('click', flipNextPage);
    dom.createNewBtn.addEventListener('click', () => {
        resetView();
        currentContentSource = { type: null, value: null };
        updateGenerateButtonState();
    });
    dom.fullscreenBtn.addEventListener('click', toggleFullScreen);
    
    // Search
    dom.searchBtn.addEventListener('click', performSearch);
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') performSearch();
    });
     document.addEventListener('click', (e) => {
        // FIX: Cast e.target to Node to satisfy 'contains' method argument type.
        if (!dom.searchContainer.contains(e.target as Node)) {
            dom.searchResults.classList.add('hidden');
        }
    });

    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', handleFullScreenChange);

    // Initialize UI Effects
    addSparkleEffect(dom.generateBtn as HTMLElement);
    addSparkleEffect(dom.createNewBtn as HTMLElement);

    // Initialize Gemini-powered features
    initTts();
}

// --- App Initialization ---

document.addEventListener('DOMContentLoaded', initEventListeners);