const sidebar = document.getElementById('sidebar');
const toggleSidebar = document.getElementById('toggleSidebar');
const submenuLinks = document.querySelectorAll('.sidebar ul li > a');
const sidebarFull = document.getElementById('sidebarFull');

// ✅ Desktop + mobile toggle fix
toggleSidebar.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open'); // Mobile slide
    } else {
        sidebar.classList.toggle('closed'); // Desktop collapse
    }
});

// Submenu toggle
submenuLinks.forEach(link => {
    link.addEventListener('click', e => {
        const parent = link.parentElement;
        const submenu = parent.querySelector('.submenu');
        if (submenu) {
            e.preventDefault();
            document.querySelectorAll('.sidebar ul li.open').forEach(li => {
                if (li !== parent) li.classList.remove('open');
            });
            parent.classList.toggle('open');
        }
    });
});

// Fullscreen
sidebarFull.addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
});

// Box numbers animation
function animateNumbers() {
    document.querySelectorAll(".box-number").forEach(num => {

        const targetAttr = num.getAttribute("data-target");

        // Agar target empty, null, ya NaN ho → skip
        if (!targetAttr || isNaN(targetAttr)) return;

        const target = +targetAttr;

        let count = 0;
        const increment = target / 60;

        const timer = setInterval(() => {
            count += increment;

            if (count >= target) {
                count = target;
                clearInterval(timer);
            }

            num.textContent = Math.floor(count);
        }, 30);
    });
}

window.addEventListener("load", animateNumbers);