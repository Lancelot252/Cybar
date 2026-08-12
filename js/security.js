(function installCsrfFetchProtection() {
    const originalFetch = window.fetch.bind(window);
    let tokenPromise;

    async function csrfToken() {
        if (!tokenPromise) {
            tokenPromise = originalFetch('/api/csrf-token', {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' }
            }).then(response => {
                if (!response.ok) throw new Error('Unable to initialize request protection');
                return response.json();
            }).then(data => data.csrfToken).catch(error => {
                tokenPromise = null;
                throw error;
            });
        }
        return tokenPromise;
    }

    window.fetch = async function protectedFetch(input, init = {}) {
        const requestUrl = new URL(input instanceof Request ? input.url : input, window.location.href);
        const method = String(init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (requestUrl.origin !== window.location.origin || ['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            return originalFetch(input, init);
        }

        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
        headers.set('X-CSRF-Token', await csrfToken());
        return originalFetch(input, { ...init, headers, credentials: init.credentials || 'same-origin' });
    };
})();
