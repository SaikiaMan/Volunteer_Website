(function () {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const transitionDuration = reducedMotion ? 0 : 420;

    function navigateWithTransition(url) {
        if (reducedMotion) {
            window.location.href = url;
            return;
        }

        document.body.classList.add('page-transition-exit');
        window.setTimeout(function () {
            window.location.href = url;
        }, transitionDuration);
    }

    window.navigateWithTransition = navigateWithTransition;

    function bindNavigationLinks() {
        document.querySelectorAll('a[href="app.html"]').forEach(function (link) {
            if (link.dataset.transitionBound === 'true') return;
            link.dataset.transitionBound = 'true';
            link.addEventListener('click', function (event) {
                if (event.defaultPrevented || link.target === '_blank') return;

                event.preventDefault();
                navigateWithTransition(link.href);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindNavigationLinks);
    } else {
        bindNavigationLinks();
    }
}());
