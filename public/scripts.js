// scripts.js

document.addEventListener('DOMContentLoaded', () => {
    // Navigation Toggle for Mobile
    const navbarToggle = document.querySelector('.navbar-toggle');
    const navbarMenu = document.getElementById('navbar-menu'); // Updated to use ID

    // Function to toggle the navigation menu
    const toggleNavbarMenu = (e) => {
        e.stopPropagation(); // Prevent the event from bubbling up to the document
        navbarMenu.classList.toggle('active');
        // Toggle aria-expanded for accessibility
        const isExpanded = navbarMenu.classList.contains('active');
        navbarToggle.setAttribute('aria-expanded', isExpanded);
    };

    // Attach click event listener to the toggle button
    navbarToggle.addEventListener('click', toggleNavbarMenu);

    // Prevent clicks inside the navbarMenu from closing the menu
    navbarMenu.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent the event from bubbling up to the document
    });

    // Close the menu when clicking outside of navbarToggle and navbarMenu
    document.addEventListener('click', (event) => {
        if (!navbarToggle.contains(event.target) && !navbarMenu.contains(event.target)) {
            if (navbarMenu.classList.contains('active')) {
                navbarMenu.classList.remove('active');
                navbarToggle.setAttribute('aria-expanded', false);
            }
        }
    });

    // Close the menu when pressing the ESC key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && navbarMenu.classList.contains('active')) {
            navbarMenu.classList.remove('active');
            navbarToggle.setAttribute('aria-expanded', false);
        }
    });

    // Collapsible Sections
    const collapsibleSections = document.querySelectorAll('.collapsible-section');

    collapsibleSections.forEach(section => {
        const header = section.querySelector('.section-header');
        const collapseBtn = section.querySelector('.collapse-btn');
        const hideBtn = section.querySelector('.hide-btn');

        header.addEventListener('click', (e) => {
            // Prevent toggling when clicking on settings or hide buttons
            if (e.target.closest('.settings-btn') || e.target.closest('.hide-btn')) return;

            toggleSection(section);
        });

        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the header click
            toggleSection(section);
        });

        hideBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the header click
            hideSection(section);
        });
    });

    function toggleSection(section) {
        section.classList.toggle('collapsed');
        const isCollapsed = section.classList.contains('collapsed');
        const collapseBtn = section.querySelector('.collapse-btn');
        const ariaExpanded = !isCollapsed;
        collapseBtn.setAttribute('aria-expanded', ariaExpanded);
        const icon = collapseBtn.querySelector('i');
        if (isCollapsed) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        } else {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }

        adjustLayout();
    }

    function hideSection(section) {
        section.classList.add('hidden');
        updateNavbarMenu(section.id, false);
        adjustLayout();
    }

    function showSection(section) {
        section.classList.remove('hidden');
        updateNavbarMenu(section.id, true);
        adjustLayout();
    }

    // Settings Buttons (Placeholder for future functionality)
    const settingsButtons = document.querySelectorAll('.settings-btn');
    settingsButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the header click
            // Implement settings functionality here
            alert('Settings button clicked!');
        });
    });

    // Toggle Sections via Navigation Menu
    const toggleCheckboxes = document.querySelectorAll('.toggle-section');
    toggleCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const targetId = e.target.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (e.target.checked) {
                showSection(targetSection);
            } else {
                hideSection(targetSection);
            }
        });
    });

    function updateNavbarMenu(sectionId, isVisible) {
        const checkbox = document.querySelector(`.toggle-section[data-target="${sectionId}"]`);
        if (checkbox) {
            checkbox.checked = isVisible;
        }
    }

    function adjustLayout() {
        const visibleSections = document.querySelectorAll('.collapsible-section:not(.hidden)');
        if (visibleSections.length === 1) {
            // Set the visible section to 100%
            visibleSections[0].style.flex = '1 1 100%';
        } else if (visibleSections.length === 2) {
            // Retrieve flex values from localStorage or set default
            const leftFlex = localStorage.getItem('leftSectionFlex') || 50;
            const rightFlex = localStorage.getItem('rightSectionFlex') || 50;
            const leftSection = document.getElementById('chat');
            const rightSection = document.getElementById('questions');

            leftSection.style.flex = `1 1 ${leftFlex}%`;
            rightSection.style.flex = `1 1 ${rightFlex}%`;
        }
    }

    // Resizable Sections
    const resizer = document.querySelector('.resizer');
    const leftSection = document.getElementById('chat');
    const rightSection = document.getElementById('questions');
    let isResizing = false;

    // Variables to store the initial positions and sizes
    let startX, startY, startLeftFlex, startRightFlex;

    resizer.addEventListener('mousedown', function(e) {
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;

        // Get current flex-basis in percentage
        startLeftFlex = parseFloat(getComputedStyle(leftSection).flexBasis) || 50;
        startRightFlex = parseFloat(getComputedStyle(rightSection).flexBasis) || 50;

        document.body.style.cursor = getComputedStyle(resizer).cursor;
        document.body.style.userSelect = 'none';
    });

    resizer.addEventListener('dblclick', function(e) {
        e.preventDefault();
        // Reset to default half and half
        leftSection.style.flex = '1 1 50%';
        rightSection.style.flex = '1 1 50%';
        localStorage.removeItem('leftSectionFlex');
        localStorage.removeItem('rightSectionFlex');
    });

    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;

        const container = document.querySelector('.container');
        const containerRect = container.getBoundingClientRect();
        const isVertical = window.innerWidth > 768;

        // Use requestAnimationFrame for smoother updates
        window.requestAnimationFrame(() => {
            if (isVertical) {
                let deltaX = e.clientX - startX;
                let containerWidth = containerRect.width;
                let deltaPercent = (deltaX / containerWidth) * 100;

                let newLeftFlex = startLeftFlex + deltaPercent;
                let newRightFlex = startRightFlex - deltaPercent;

                // Set minimum and maximum percentages
                const minFlex = 20;
                const maxFlex = 80;
                if (newLeftFlex < minFlex || newLeftFlex > maxFlex) return;
                if (newRightFlex < minFlex || newRightFlex > maxFlex) return;

                leftSection.style.flex = `1 1 ${newLeftFlex}%`;
                rightSection.style.flex = `1 1 ${newRightFlex}%`;
            } else {
                let deltaY = e.clientY - startY;
                let containerHeight = containerRect.height;
                let deltaPercent = (deltaY / containerHeight) * 100;

                let newTopFlex = startLeftFlex + deltaPercent;
                let newBottomFlex = startRightFlex - deltaPercent;

                // Set minimum and maximum percentages
                const minFlex = 20;
                const maxFlex = 80;
                if (newTopFlex < minFlex || newTopFlex > maxFlex) return;
                if (newBottomFlex < minFlex || newBottomFlex > maxFlex) return;

                leftSection.style.flex = `1 1 ${newTopFlex}%`;
                rightSection.style.flex = `1 1 ${newBottomFlex}%`;
            }

            // Store sizes in localStorage
            const visibleSections = document.querySelectorAll('.collapsible-section:not(.hidden)');
            if (visibleSections.length === 2) {
                const currentLeftFlex = parseFloat(getComputedStyle(leftSection).flexBasis);
                const currentRightFlex = parseFloat(getComputedStyle(rightSection).flexBasis);
                localStorage.setItem('leftSectionFlex', currentLeftFlex);
                localStorage.setItem('rightSectionFlex', currentRightFlex);
            }
        });
    });

    document.addEventListener('mouseup', function(e) {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        }
    });

    // Handle Window Resize to Adjust Resizer Orientation
    window.addEventListener('resize', function() {
        const isVertical = window.innerWidth > 768;
        if (isVertical) {
            resizer.style.cursor = 'col-resize';
            resizer.setAttribute('aria-orientation', 'vertical');
        } else {
            resizer.style.cursor = 'row-resize';
            resizer.setAttribute('aria-orientation', 'horizontal');
        }
    });

    // Initialize Layout Based on LocalStorage or Default
    function initializeLayout() {
        const leftFlex = localStorage.getItem('leftSectionFlex');
        const rightFlex = localStorage.getItem('rightSectionFlex');

        const visibleSections = document.querySelectorAll('.collapsible-section:not(.hidden)');
        if (visibleSections.length === 1) {
            visibleSections[0].style.flex = '1 1 100%';
        } else if (visibleSections.length === 2) {
            if (leftFlex && rightFlex) {
                leftSection.style.flex = `1 1 ${leftFlex}%`;
                rightSection.style.flex = `1 1 ${rightFlex}%`;
            } else {
                leftSection.style.flex = '1 1 50%';
                rightSection.style.flex = '1 1 50%';
            }
        }
    }

    initializeLayout();
});
