(() => {
    'use strict';

    const STORAGE_KEY = 'legrot-theme';
    const root = document.documentElement;
    const MIN_QUERY = 1;

    const initTheme = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
            root.setAttribute('data-theme', stored);
            return;
        }
        root.setAttribute('data-theme', 'light');
    };

    const toggleTheme = () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        localStorage.setItem(STORAGE_KEY, next);
    };

    const closeMobileMenu = () => {
        const mobileMenu = document.getElementById('mobileMenu');
        const burger = document.getElementById('burger');
        if (!mobileMenu || !burger) return;
        mobileMenu.hidden = true;
        burger.setAttribute('aria-expanded', 'false');
    };

    const initSmoothScroll = () => {
        document.querySelectorAll('[data-scroll]').forEach((link) => {
            link.addEventListener('click', (event) => {
                const href = link.getAttribute('href');
                if (!href || !href.startsWith('#')) return;
                const target = document.querySelector(href);
                if (!target) return;
                event.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                closeMobileMenu();
            });
        });
    };

    /* ---------------- Search ---------------- */

    const escapeHtml = (str) =>
        String(str).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));

    const normalize = (value) => value.toLowerCase().trim();

    const highlight = (text, query) => {
        if (!query) return escapeHtml(text);
        const safe = escapeHtml(text);
        const idx = safe.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1) return safe;
        return (
            safe.slice(0, idx) +
            '<mark>' + safe.slice(idx, idx + query.length) + '</mark>' +
            safe.slice(idx + query.length)
        );
    };

    const scorePage = (page, query) => {
        const title = normalize(page.title);
        const desc = normalize(page.description || '');
        const keywords = normalize(page.keywords || '');
        const category = normalize(page.category || '');

        let score = 0;

        if (title.startsWith(query)) score += 100;
        else if (title.includes(query)) score += 60;

        if (keywords.includes(query)) score += 40;
        if (category.includes(query)) score += 20;
        if (desc.includes(query)) score += 10;

        return score;
    };

    const findPages = (query) => {
        const pages = window.LEGROT_PAGES || [];
        const q = normalize(query);
        if (q.length < MIN_QUERY) return [];

        return pages
            .map((page) => ({ page, score: scorePage(page, q) }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
            .map((entry) => entry.page);
    };

    const initSearch = () => {
        const input = document.getElementById('search');
        const results = document.getElementById('searchResults');
        const wrapper = document.getElementById('bigSearch');
        if (!input || !results || !wrapper) return;

        let activeIndex = -1;
        let currentResults = [];

        const close = () => {
            results.hidden = true;
            results.innerHTML = '';
            input.setAttribute('aria-expanded', 'false');
            activeIndex = -1;
            currentResults = [];
        };

        const render = (list, query) => {
            currentResults = list;
            activeIndex = -1;

            if (!list.length) {
                results.innerHTML = `
                    <div class="search-empty">
                        Ничего не найдено
                        <span class="search-empty__hint">Попробуйте другое слово</span>
                    </div>
                `;
                results.hidden = false;
                input.setAttribute('aria-expanded', 'true');
                return;
            }

            results.innerHTML = list
    .map((page, i) => `
        <a
            href="${escapeHtml(page.path)}"
            class="search-result"
            data-index="${i}"
            role="option"
        >
            <span class="search-result__icon">${escapeHtml(page.icon || '📄')}</span>
            <span class="search-result__body">
                <span class="search-result__title">${highlight(page.title, query)}</span>
                <span class="search-result__path">${escapeHtml(page.category || 'Страница')}</span>
            </span>
        </a>
    `)
    .join('');

            results.hidden = false;
            input.setAttribute('aria-expanded', 'true');
        };

        const updateActive = () => {
            results.querySelectorAll('.search-result').forEach((el, i) => {
                el.classList.toggle('is-active', i === activeIndex);
            });
            const active = results.querySelector('.search-result.is-active');
            if (active) active.scrollIntoView({ block: 'nearest' });
        };

        input.addEventListener('input', () => {
            const query = input.value.trim();
            if (query.length < MIN_QUERY) {
                close();
                return;
            }
            render(findPages(query), query);
        });

        input.addEventListener('focus', () => {
            if (input.value.trim().length >= MIN_QUERY) {
                render(findPages(input.value.trim()), input.value.trim());
            }
        });

        input.addEventListener('keydown', (event) => {
            if (results.hidden) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (!currentResults.length) return;
                activeIndex = (activeIndex + 1) % currentResults.length;
                updateActive();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (!currentResults.length) return;
                activeIndex = activeIndex <= 0 ? currentResults.length - 1 : activeIndex - 1;
                updateActive();
            } else if (event.key === 'Enter') {
                event.preventDefault();
                const target = currentResults[activeIndex] || currentResults[0];
                if (target) window.location.href = target.path;
            } else if (event.key === 'Escape') {
                close();
                input.blur();
            }
        });

        document.addEventListener('click', (event) => {
            if (!wrapper.contains(event.target)) close();
        });

        document.addEventListener('keydown', (event) => {
            const isMac = navigator.platform.toUpperCase().includes('MAC');
            const modifier = isMac ? event.metaKey : event.ctrlKey;
            if (modifier && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                input.focus();
                input.select();
            }
        });
    };

    const initToTop = () => {
        const button = document.getElementById('toTop');
        if (!button) return;

        const toggle = () => {
            button.classList.toggle('is-visible', window.scrollY > 400);
        };

        button.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        window.addEventListener('scroll', toggle, { passive: true });
        toggle();
    };

    const initReveal = () => {
        const elements = document.querySelectorAll('.reveal');
        if (!elements.length) return;

        if (!('IntersectionObserver' in window)) {
            elements.forEach((el) => el.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
        );

        elements.forEach((el) => observer.observe(el));
    };

    const initYear = () => {
        const year = document.getElementById('year');
        if (year) year.textContent = new Date().getFullYear();
    };

    const initDropdown = () => {
        const dropdown = document.getElementById('categoriesMenu');
        const dropdownBtn = document.getElementById('categoriesBtn');
        if (!dropdown || !dropdownBtn) return;

        const open = () => {
            dropdown.hidden = false;
            requestAnimationFrame(() => dropdown.classList.add('is-open'));
            dropdownBtn.setAttribute('aria-expanded', 'true');
        };

        const close = () => {
            dropdown.classList.remove('is-open');
            dropdownBtn.setAttribute('aria-expanded', 'false');
            window.setTimeout(() => {
                if (!dropdown.classList.contains('is-open')) dropdown.hidden = true;
            }, 200);
        };

        dropdownBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = dropdownBtn.getAttribute('aria-expanded') === 'true';
            isOpen ? close() : open();
        });

        document.addEventListener('click', (event) => {
            if (dropdown.hidden) return;
            if (dropdown.contains(event.target) || dropdownBtn.contains(event.target)) return;
            close();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') close();
        });
    };

    const initMobileMenu = () => {
        const mobileMenu = document.getElementById('mobileMenu');
        const burger = document.getElementById('burger');
        if (!mobileMenu || !burger) return;

        burger.addEventListener('click', () => {
            const isOpen = burger.getAttribute('aria-expanded') === 'true';
            if (isOpen) {
                closeMobileMenu();
            } else {
                mobileMenu.hidden = false;
                burger.setAttribute('aria-expanded', 'true');
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 900) closeMobileMenu();
        });
    };

    const init = () => {
        initTheme();
        initSmoothScroll();
        initSearch();
        initToTop();
        initReveal();
        initYear();
        initDropdown();
        initMobileMenu();

        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();