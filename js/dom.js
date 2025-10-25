export const dom = {
    appContainer: document.getElementById('app-container'),
    tabsContainer: document.querySelector('.tabs'),
    fileTabBtn: document.getElementById('file-tab-btn'),
    textTabBtn: document.getElementById('text-tab-btn'),
    fileUploadView: document.getElementById('file-upload-view'),
    textPasteView: document.getElementById('text-paste-view'),
    dropzoneInput: document.getElementById('dropzone-file'),
    dropzoneLabel: document.querySelector('.dropzone'),
    fileNameDisplay: document.getElementById('file-name'),
    textInput: document.getElementById('text-input'),
    generateBtn: document.getElementById('generate-btn'),
    
    // Customization
    themeSelector: document.getElementById('theme-selector'),
    coverTitle: document.getElementById('cover-title'),
    coverAuthor: document.getElementById('cover-author'),
    coverImageInput: document.getElementById('cover-image-input'),
    coverImageName: document.getElementById('cover-image-name'),
    narrationToggle: document.getElementById('narration-toggle'),
    
    loader: document.getElementById('loader'),
    loaderProgress: document.getElementById('loader-progress'),
    loaderProgressText: document.getElementById('loader-progress-text'),
    errorDisplay: document.getElementById('error-display'),
    errorMessage: document.getElementById('error-message'),
    welcomeMessage: document.getElementById('welcome-message'),
    
    // Flipbook Area
    flipbookWrapper: document.getElementById('flipbook-wrapper'),
    flipbookEl: document.getElementById('flipbook'),
    prevPageBtn: document.getElementById('prev-page-btn'),
    nextPageBtn: document.getElementById('next-page-btn'),
    pageCounter: document.getElementById('page-counter'),
    createNewBtn: document.getElementById('create-new-btn'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    enterFullscreenIcon: document.getElementById('enter-fullscreen-icon'),
    exitFullscreenIcon: document.getElementById('exit-fullscreen-icon'),
    
    // Search
    searchContainer: document.querySelector('.search-container'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    searchResults: document.getElementById('search-results'),

    // Templates
    narrationButtonTemplate: document.getElementById('narration-button-template'),
};
