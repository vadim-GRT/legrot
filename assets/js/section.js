(() => {
    'use strict';

    const STORAGE_KEY = 'legrot-theme';
    const root = document.documentElement;

    const initTheme = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
        root.setAttribute('data-theme', stored);
        return;
    }
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    root.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
};

    const toggleTheme = () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        localStorage.setItem(STORAGE_KEY, next);
    };

    const initYear = () => {
        const year = document.getElementById('year');
        if (year) year.textContent = new Date().getFullYear();
    };

    const initItemCount = () => {
        const grid = document.querySelector('[data-items]');
        const counter = document.querySelector('[data-count]');
        if (!grid || !counter) return;
        const count = grid.querySelectorAll('.item').length;
        counter.textContent = count === 0
            ? '0'
            : `${count}`;
    };

    const init = () => {
        initTheme();
        initYear();
        initItemCount();

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();