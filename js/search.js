
import { dom } from './dom.js';
import { state } from './state.js';
import { flipToPage } from './flipbook.js';

function displaySearchResults(results) {
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
                dom.searchInput.value = '';
            });
            dom.searchResults.appendChild(item);
        });
    }
    dom.searchResults.classList.remove('hidden');
}

export function performSearch() {
    const query = dom.searchInput.value.trim().toLowerCase();
    if (!query) {
        dom.searchResults.classList.add('hidden');
        return;
    }
    
    const results = [];
    state.searchablePages.forEach((pageText, index) => {
        if (pageText.toLowerCase().includes(query)) {
            results.push(index);
        }
    });
    
    displaySearchResults(results);
}
