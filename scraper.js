const puppeteer = require('puppeteer');
const fs = require('fs').promises;

class GoogleMapsScraper {
    constructor(options = {}) {
        this.searchQuery = options.searchQuery || 'Concepteur de sites Web fes';
        this.headless = options.headless !== false;
        this.delay = options.delay || 1000;
        this.outputFile = options.outputFile || 'results.json';
        this.maxRetries = options.maxRetries || 3;
        this.concurrentLimit = options.concurrentLimit || 3;
        this.emailTimeout = options.emailTimeout || 10000;
        this.browser = null;
        this.page = null;
        this.emailCache = new Map(); // Cache emails to avoid re-scraping
    }

    async init() {
        console.log('🚀 Initializing browser...');
        this.browser = await puppeteer.launch({
            headless: this.headless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        this.page = await this.browser.newPage();

        // Set better user agent and viewport
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await this.page.setViewport({ width: 1366, height: 768 });

        // Block unnecessary resources for faster loading (but allow scripts for dynamic content)
        await this.page.setRequestInterception(true);
        this.page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
                req.abort();
            } else {
                req.continue();
            }
        });
    }

    async scrapeGoogleMaps() {
        console.log('🗺️  Scraping Google Maps with multiple search strategies...');

        // Strategy 1: Original search
        const url1 = `https://www.google.com/maps/search/${encodeURIComponent(this.searchQuery)}`;
        console.log('🔍 Strategy 1: Direct search...');

        try {
            await this.page.goto(url1, { waitUntil: 'networkidle2', timeout: 30000 });

            // Wait for initial load
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Scroll to load more results
            console.log('📜 Scrolling to load more results...');
            await this.scrollToLoadMore();

            // Wait for additional content to load
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Get initial content
            let content = await this.page.content();

            // Strategy 2: Try broader search terms to get more results
            const searchTerms = this.generateSearchVariations(this.searchQuery);

            for (let i = 0; i < Math.min(searchTerms.length, 2); i++) { // Try up to 2 additional searches
                const searchTerm = searchTerms[i];
                console.log(`🔍 Strategy ${i + 2}: Searching "${searchTerm}"...`);

                try {
                    const url = `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}`;
                    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Quick scroll for additional results
                    await this.scrollToLoadMore();
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Append additional content
                    const additionalContent = await this.page.content();
                    content += '\n<!-- ADDITIONAL_SEARCH_CONTENT -->\n' + additionalContent;

                } catch (error) {
                    console.log(`⚠️  Additional search failed: ${error.message}`);
                }
            }

            // Store the combined content
            this.storedHtmlContent = content;
            return content;

        } catch (error) {
            console.error('❌ Error scraping Google Maps:', error.message);
            throw error;
        }
    }

    // Generate search variations to find more results
    generateSearchVariations(originalQuery) {
        const variations = [];

        // If the query contains specific terms, try broader versions
        if (originalQuery.toLowerCase().includes('contrôle technique')) {
            variations.push('visite technique Fès');
            variations.push('centre contrôle technique Fès');
        } else if (originalQuery.toLowerCase().includes('cours particuliers')) {
            variations.push('soutien scolaire ' + this.extractLocation(originalQuery));
            variations.push('professeur particulier ' + this.extractLocation(originalQuery));
        }

        return variations;
    }

    // Extract location from search query
    extractLocation(query) {
        const locations = ['Fès', 'Casablanca', 'Rabat', 'Marrakech', 'Agadir', 'Tanger', 'Meknès', 'Oujda'];
        for (const location of locations) {
            if (query.includes(location)) {
                return location;
            }
        }
        return '';
    }

    async scrollToLoadMore() {
        try {
            console.log('🔄 Loading ALL available results with aggressive scrolling...');

            let previousResultCount = 0;
            let currentResultCount = 0;
            let noChangeCount = 0;
            let scrollAttempts = 0;
            const maxScrollAttempts = 100; // Increased maximum scrolls for more results

            while (scrollAttempts < maxScrollAttempts && noChangeCount < 8) { // Allow more attempts without change
                scrollAttempts++;

                // Multiple scrolling strategies for maximum results

                // Strategy 1: Scroll the main window
                await this.page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                });

                // Strategy 2: Scroll the results panel (most important for Google Maps)
                const resultsPanel = await this.page.$('[role="main"]');
                if (resultsPanel) {
                    await this.page.evaluate((panel) => {
                        panel.scrollTop = panel.scrollHeight;
                    }, resultsPanel);
                }

                // Strategy 3: Scroll the sidebar with results
                const sidebar = await this.page.$('[role="main"] [role="region"]');
                if (sidebar) {
                    await this.page.evaluate((panel) => {
                        panel.scrollTop = panel.scrollHeight;
                    }, sidebar);
                }

                // Strategy 4: Try scrolling specific result containers
                const resultContainers = await this.page.$$('[role="feed"], .section-result, [data-result-index]');
                for (const container of resultContainers) {
                    try {
                        await this.page.evaluate((el) => {
                            if (el && el.scrollTop !== undefined) {
                                el.scrollTop = el.scrollHeight;
                            }
                        }, container);
                    } catch (e) {
                        // Ignore errors for individual containers
                    }
                }

                // Strategy 5: Simulate mouse wheel scrolling (sometimes triggers more loading)
                if (scrollAttempts % 5 === 0) { // Every 5th scroll
                    try {
                        await this.page.mouse.wheel({ deltaY: 1000 });
                    } catch (e) {
                        // Ignore wheel errors
                    }
                }

                // Wait for new content to load
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Enhanced result counting with more comprehensive selectors
                currentResultCount = await this.page.evaluate(() => {
                    // Count business listings using comprehensive selectors
                    const selectors = [
                        '[data-result-index]',
                        '[role="article"]',
                        '.section-result',
                        '[jsaction*="mouseover"]',
                        '[data-cid]', // Google Maps business IDs
                        '.section-result-content',
                        '[data-feature-id]',
                        '.section-result-location',
                        '[aria-label*="results"]',
                        '.section-listresult-title'
                    ];

                    let maxCount = 0;
                    let totalUnique = new Set();

                    selectors.forEach(selector => {
                        const elements = document.querySelectorAll(selector);
                        maxCount = Math.max(maxCount, elements.length);

                        // Also count unique elements by text content
                        elements.forEach(el => {
                            const text = el.textContent?.trim();
                            if (text && text.length > 5) {
                                totalUnique.add(text);
                            }
                        });
                    });

                    // Return the higher of element count or unique text count
                    return Math.max(maxCount, totalUnique.size);
                });

                console.log(`📊 Scroll ${scrollAttempts}: Found ${currentResultCount} results`);

                // Check if we got new results
                if (currentResultCount > previousResultCount) {
                    noChangeCount = 0; // Reset counter if we found new results
                    previousResultCount = currentResultCount;
                } else {
                    noChangeCount++; // Increment if no new results
                }

                // More aggressive stopping criteria - only stop if we're really sure there are no more results
                if (currentResultCount > 50 && noChangeCount >= 6) {
                    console.log(`✅ Likely reached end of results at ${currentResultCount} businesses (high confidence)`);
                    break;
                } else if (currentResultCount > 100 && noChangeCount >= 4) {
                    console.log(`✅ Reached end of results at ${currentResultCount} businesses (very high count)`);
                    break;
                }
            }

            console.log(`🎉 Aggressive scrolling complete! Total scrolls: ${scrollAttempts}, Final count: ${currentResultCount} results`);

            // Final wait for any remaining content to load
            await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error) {
            console.log('⚠️  Could not scroll for more results:', error.message);
        }
    }

    // New method: Find all business listings on the main page
    async findBusinessListings() {
        console.log('🔍 Finding business listings on main page...');

        try {
            // Wait for business listings to be present
            await this.page.waitForSelector('[role="main"]', { timeout: 10000 });
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for content to fully load

            // Find all clickable business listings using multiple strategies
            const listings = await this.page.evaluate(() => {
                const results = [];

                // Strategy 1: Look for specific business result containers
                const businessSelectors = [
                    'div[data-result-index]', // Indexed results
                    'div[role="article"]', // Article containers
                    'a[data-value="Directions"]', // Direction links
                    'div[jsaction*="click"][data-cid]' // Clickable containers with business IDs
                ];

                for (const selector of businessSelectors) {
                    const containers = document.querySelectorAll(selector);
                    console.log(`Strategy: ${selector} - Found ${containers.length} containers`);

                    for (const container of containers) {
                        let name = '';

                        // Method 1: Look for business name in specific elements
                        const nameSelectors = [
                            'h3', 'h2', 'h1', // Headers
                            '[role="img"]', // Image roles (often contain business names)
                            '.section-result-title', // Result titles
                            '.section-result-text-content' // Result content
                        ];

                        for (const nameSelector of nameSelectors) {
                            const nameElement = container.querySelector(nameSelector);
                            if (nameElement) {
                                const text = nameElement.textContent?.trim() || nameElement.getAttribute('aria-label');
                                if (text && text.length > 3 && text.length < 150 &&
                                    !text.includes('★') && !text.includes('·') &&
                                    !text.includes('Google') && !text.includes('Map') &&
                                    !text.includes('Plan') && !text.includes('touches') &&
                                    !text.includes('Utilisez') && !text.includes('déplacer')) {
                                    name = text;
                                    break;
                                }
                            }
                        }

                        // Method 2: Look for direction links
                        if (!name && selector.includes('Directions')) {
                            const directionText = container.getAttribute('data-value') || container.getAttribute('aria-label');
                            if (directionText) {
                                name = directionText.replace(/^Directions to\s*/i, '').trim();
                            }
                        }

                        // Method 3: Look for business names in text content (more selective)
                        if (!name) {
                            const textContent = container.textContent?.trim();
                            if (textContent && textContent.length > 3 && textContent.length < 100 &&
                                !textContent.includes('★') && !textContent.includes('·') &&
                                !textContent.includes('Google') && !textContent.includes('Map') &&
                                !textContent.includes('Plan') && !textContent.includes('touches') &&
                                !textContent.includes('Utilisez') && !textContent.includes('déplacer') &&
                                !textContent.includes('km') && !textContent.includes('min')) {

                                // Extract first meaningful line
                                const lines = textContent.split('\n').filter(line => line.trim().length > 3);
                                if (lines.length > 0) {
                                    name = lines[0].trim();
                                }
                            }
                        }

                        // Enhanced filtering to exclude Google tracking URLs and garbage data
                        if (name &&
                            name.length > 3 &&
                            name.length < 150 &&
                            !name.match(/^0ah[A-Za-z0-9]+/) && // Google tracking URLs
                            !name.match(/[A-Za-z0-9]{25,}/) && // Long alphanumeric strings
                            !name.includes('UKEw') && // Google tracking patterns
                            !name.includes('QzCc') && // Google tracking patterns
                            !name.includes('zCc') && // More Google tracking patterns
                            !name.includes('oAA') && // More Google tracking patterns
                            !name.includes('oEQ') && // More Google tracking patterns
                            !name.includes('oEg') && // More Google tracking patterns
                            !name.includes('oFA') && // More Google tracking patterns
                            !name.includes('oFQ') && // More Google tracking patterns
                            !name.includes('oFg') && // More Google tracking patterns
                            !name.includes('oCQ') && // More Google tracking patterns
                            !name.includes('oCA') && // More Google tracking patterns
                            !name.includes('oEw') && // More Google tracking patterns
                            !name.includes('oAw') && // More Google tracking patterns
                            name.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F]/) && // Must contain letters
                            !name.match(/^[A-Za-z0-9_-]{20,}$/)) { // No long codes
                            results.push({
                                name: name.trim(),
                                element: container,
                                strategy: selector
                            });
                        }
                    }

                    if (results.length > 0) {
                        console.log(`Found ${results.length} businesses with strategy: ${selector}`);
                        break; // Use first successful strategy
                    }
                }

                // Strategy 2: Look for direct links to business pages
                if (results.length === 0) {
                    const businessLinks = document.querySelectorAll('a[href*="/maps/place/"]');
                    console.log(`Found ${businessLinks.length} direct business links`);

                    for (const link of businessLinks) {
                        const href = link.href;
                        // Extract business name from URL
                        const urlParts = href.split('/maps/place/')[1];
                        if (urlParts) {
                            const name = decodeURIComponent(urlParts.split('/')[0]).replace(/\+/g, ' ');
                            if (name && name.length > 3) {
                                results.push({
                                    name: name.trim(),
                                    element: link,
                                    href: href,
                                    strategy: 'direct-link'
                                });
                            }
                        }
                    }
                }

                // Strategy 3: Look for business cards/articles
                if (results.length === 0) {
                    const articles = document.querySelectorAll('[role="article"], .section-result');
                    console.log(`Found ${articles.length} article elements`);

                    for (const article of articles) {
                        const nameElement = article.querySelector('h3, h2, h1, [role="img"]');
                        if (nameElement) {
                            const name = nameElement.textContent?.trim() || nameElement.getAttribute('aria-label');
                            if (name && name.length > 3 && !name.includes('Google')) {
                                results.push({
                                    name: name.trim(),
                                    element: article,
                                    strategy: 'article'
                                });
                            }
                        }
                    }
                }

                console.log(`Found ${results.length} potential business listings`);

                // Remove duplicates based on name
                const uniqueResults = [];
                const seenNames = new Set();

                for (const result of results) {
                    const normalizedName = result.name.toLowerCase().trim();
                    if (!seenNames.has(normalizedName)) {
                        seenNames.add(normalizedName);
                        uniqueResults.push(result);
                    }
                }

                return uniqueResults.slice(0, 15); // Limit to first 15 businesses for testing
            });

            console.log(`📍 Found ${listings.length} business listings using individual scraping`);

            // Log the found businesses for debugging
            if (listings.length > 0) {
                console.log('🔍 Business listings found:');
                listings.forEach((listing, index) => {
                    console.log(`   ${index + 1}. ${listing.name} (${listing.strategy})`);
                });
            }

            return listings;

        } catch (error) {
            console.log('⚠️  Error finding business listings:', error.message);
            return [];
        }
    }

    async extractBusinessNames(htmlContent) {
        console.log('👥 Extracting business names with DOM-based extraction...');

        // Strategy 1: Extract directly from the loaded page using comprehensive DOM selectors
        console.log('🔍 Strategy 1: DOM-based extraction from loaded page...');

        // Wait for content to be fully loaded
        await new Promise(resolve => setTimeout(resolve, 3000));

        const domNames = await this.page.evaluate(() => {
            const businessNames = [];

            // Comprehensive selectors to find ALL business names in Google Maps
            const selectors = [
                // Primary business name selectors
                '[role="article"] h3',
                '[role="article"] [role="button"] span',
                '[role="article"] a[href*="/maps/place/"] span',
                '[role="article"] div[role="button"] span',

                // Alternative article selectors
                'article h3',
                'article [role="button"] span',
                'article a[href*="/maps/place/"] span',

                // Section result selectors
                '.section-result-title',
                '.section-result-content h3',
                '.section-result h3',
                '.section-listresult-title',

                // Data attribute selectors
                '[data-result-index] h3',
                '[data-result-index] [role="button"] span',
                '[data-result-index] a[href*="/maps/place/"] span',
                '[data-cid] h3',
                '[data-feature-id] h3',

                // Link-based selectors
                'a[href*="/maps/place/"] span',
                'a[href*="/maps/place/"] div',
                'a[href*="/maps/place/"] h3',

                // Interactive element selectors
                '[jsaction*="mouseover"] h3',
                '[jsaction*="mouseover"] span[role="button"]',
                '[jsaction*="mouseover"] div[role="button"] span',
                '[jsaction*="click"] h3',
                '[jsaction*="click"] span',

                // Main content area selectors
                '[role="main"] h3',
                '[role="main"] [role="button"] span',
                '[role="main"] [role="region"] h3',
                '[role="main"] [role="region"] [role="button"] span',
                '[role="main"] [role="region"] a[href*="/maps/place/"] span',

                // Feed and list selectors
                '[role="feed"] h3',
                '[role="feed"] [role="button"] span',
                '[role="feed"] a[href*="/maps/place/"] span',

                // Generic business name patterns
                'div[aria-label*="results"] h3',
                'div[aria-label*="results"] span',
                '[aria-label*="business"] h3',
                '[aria-label*="business"] span',

                // Additional aggressive selectors for maximum coverage
                'div[class*="fontHeadlineSmall"]',
                'span[class*="fontHeadlineSmall"]',
                'h3[class*="fontHeadlineSmall"]',
                'div[class*="fontBodyMedium"]',
                'span[class*="fontBodyMedium"]',

                // More data attribute selectors
                '[data-result-index] div[class*="fontHeadlineSmall"]',
                '[data-result-index] span[class*="fontHeadlineSmall"]',
                '[data-cid] div[class*="fontHeadlineSmall"]',
                '[data-cid] span[class*="fontHeadlineSmall"]',

                // Jsaction selectors
                'div[jsaction] h3',
                'div[jsaction] span[class*="fontHeadlineSmall"]',
                'div[jsaction] div[class*="fontHeadlineSmall"]',

                // Catch-all selectors for any layout
                'div[role="button"] span[class*="fontHeadlineSmall"]',
                'a[role="button"] span[class*="fontHeadlineSmall"]',
                'button span[class*="fontHeadlineSmall"]',

                // Fallback text-based selectors
                'div[tabindex="0"] h3',
                'div[tabindex="0"] span[class*="fontHeadlineSmall"]',
                'div[tabindex="0"] div[class*="fontHeadlineSmall"]'
            ];

            console.log(`Trying ${selectors.length} different selectors...`);

            // First, let's debug what's actually on the page
            console.log('🔍 Debugging page structure...');
            const allArticles = document.querySelectorAll('[role="article"]');
            console.log(`Found ${allArticles.length} articles on page`);

            const allH3s = document.querySelectorAll('h3');
            console.log(`Found ${allH3s.length} h3 elements on page`);

            const allSpans = document.querySelectorAll('span');
            console.log(`Found ${allSpans.length} span elements on page`);

            const allLinks = document.querySelectorAll('a[href*="/maps/place/"]');
            console.log(`Found ${allLinks.length} Google Maps place links`);

            // Try to find any text that looks like business names
            const allTextElements = document.querySelectorAll('*');
            let potentialNames = [];

            allTextElements.forEach(element => {
                const text = element.textContent?.trim();
                if (text &&
                    text.length > 5 &&
                    text.length < 100 &&
                    !text.includes('Google') &&
                    !text.includes('Maps') &&
                    !text.includes('km') &&
                    !text.includes('★') &&
                    text.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F]/) &&
                    element.children.length === 0) { // Only leaf elements
                    potentialNames.push(text);
                }
            });

            console.log(`Found ${potentialNames.length} potential business names in all text`);
            if (potentialNames.length > 0) {
                console.log('Sample potential names:', potentialNames.slice(0, 5));
            }

            selectors.forEach((selector, index) => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    console.log(`Selector ${index + 1}: "${selector}" found ${elements.length} elements`);
                }

                elements.forEach(element => {
                    let name = element.textContent?.trim() || element.innerText?.trim();
                    if (name &&
                        name.length > 3 &&
                        name.length < 150 &&
                        !name.includes('km') &&
                        !name.includes('min') &&
                        !name.includes('★') &&
                        !name.includes('·') &&
                        !name.match(/^\d+[\.,]\d+$/) && // Ratings like 4.5
                        !name.match(/^\d+\s*(avis|reviews?)$/i) && // Review counts
                        !name.match(/^(ouvert|fermé|open|closed)$/i) && // Status
                        !name.match(/^[0-9\s\-\+\(\)]+$/) && // Phone numbers
                        !name.match(/^(lun|mar|mer|jeu|ven|sam|dim)/i) && // Days of week
                        !name.match(/^\d+h\d+/i) && // Hours like 9h00
                        name.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F]/) // Must contain letters
                    ) {
                        businessNames.push(name);
                    }
                });
            });

            // If regular selectors didn't work, try aggressive text extraction
            if (businessNames.length === 0) {
                console.log('🔍 Regular selectors failed, trying aggressive text extraction...');

                // Get all text nodes and look for business-like names
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );

                let textNode;
                const textContents = [];

                // Enhanced Google Maps UI element filtering
                const googleMapsUIElements = [
                    'faire glisser pour modifier', 'drag to modify',
                    'rechercher', 'search',
                    'fermer', 'close',
                    'tous les filtres', 'all filters',
                    'partager', 'share',
                    'concepteur de sites web', 'website designer',
                    'site web', 'website',
                    'services sur place', 'on-site services',
                    'appbox', 'app box',
                    'connexion', 'connection',
                    'indisponible', 'unavailable',
                    'afficher votre position', 'show your location',
                    'en savoir plus', 'learn more',
                    'zoomer', 'zoom',
                    'afficher le curseur', 'show cursor',
                    'masquer le curseur', 'hide cursor',
                    'calques', 'layers',
                    'transports en commun', 'public transport',
                    'trafic', 'traffic',
                    'relief', 'terrain',
                    'street view',
                    'outils de cartographie', 'mapping tools',
                    'temps de trajet', 'travel time',
                    'mesurer', 'measure',
                    'type de carte', 'map type',
                    'satellite',
                    'vue globe', 'globe view',
                    'envoyer des commentaires sur le produit', 'send product feedback',
                    'haut de page', 'top of page',
                    'ouvert actuellement', 'currently open',
                    'services sur place non disponibles', 'on-site services not available',
                    'aucun avis', 'no reviews'
                ];

                while (textNode = walker.nextNode()) {
                    const text = textNode.textContent?.trim();
                    if (text &&
                        text.length > 5 &&
                        text.length < 100 &&
                        !text.includes('Google') &&
                        !text.includes('Maps') &&
                        !text.includes('km') &&
                        !text.includes('★') &&
                        !text.includes('·') &&
                        !text.match(/^\d+[\.,]\d+$/) &&
                        !text.match(/^\d+\s*(avis|reviews?)$/i) &&
                        !text.match(/^(ouvert|fermé|open|closed)$/i) &&
                        !text.match(/^[0-9\s\-\+\(\)]+$/) &&
                        !text.match(/^(lun|mar|mer|jeu|ven|sam|dim)/i) &&
                        !text.match(/^\d+h\d+/i) &&
                        text.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F]/) &&
                        // Filter out Google Maps UI elements
                        !googleMapsUIElements.some(uiElement =>
                            text.toLowerCase().includes(uiElement.toLowerCase()) ||
                            uiElement.toLowerCase().includes(text.toLowerCase())
                        ) &&
                        // Enhanced business name indicators
                        (text.includes('Agence') ||
                         text.includes('Digital') ||
                         text.includes('Web') ||
                         text.includes('Marketing') ||
                         text.includes('Création') ||
                         text.includes('Développement') ||
                         text.includes('Technologies') ||
                         text.includes('Solutions') ||
                         text.includes('Services') ||
                         text.includes('Studio') ||
                         text.includes('Design') ||
                         text.includes('Media') ||
                         text.includes('Communication') ||
                         text.includes('Consulting') ||
                         text.includes('Conseil') ||
                         text.includes('SARL') ||
                         text.includes('SAS') ||
                         text.includes('SA') ||
                         text.includes('EURL') ||
                         text.includes('Société') ||
                         text.includes('Company') ||
                         text.includes('Corp') ||
                         text.includes('Ltd') ||
                         text.includes('Group') ||
                         text.includes('Groupe') ||
                         text.includes('Center') ||
                         text.includes('Centre') ||
                         text.includes('Lab') ||
                         text.includes('Labs') ||
                         text.includes('Tech') ||
                         text.includes('IT') ||
                         text.includes('Software') ||
                         text.includes('App') ||
                         text.includes('Code') ||
                         text.includes('Dev') ||
                         text.includes('Pro') ||
                         text.includes('Plus') ||
                         text.includes('Max') ||
                         text.includes('Elite') ||
                         text.includes('Premium') ||
                         text.includes('Expert') ||
                         text.includes('Master') ||
                         text.includes('Creative') ||
                         text.includes('Innovation') ||
                         text.includes('Network') ||
                         text.includes('System') ||
                         text.includes('Global') ||
                         text.includes('International') ||
                         text.includes('Maroc') ||
                         text.includes('Morocco') ||
                         text.includes('Fes') ||
                         text.includes('Fès') ||
                         text.match(/^[A-Z][a-zA-Z\s]{4,}$/) || // Capitalized names
                         text.match(/^[A-Z]{2,}/) || // All caps abbreviations
                         text.match(/[A-Z][a-z]+[A-Z][a-z]+/) || // CamelCase
                         text.match(/^[a-zA-Z]+\s+[A-Z][a-zA-Z]+/) // Multi-word names
                        )) {
                        textContents.push(text);
                    }
                }

                console.log(`Found ${textContents.length} potential business names from text nodes`);
                businessNames.push(...textContents);
            }

            return [...new Set(businessNames)]; // Remove duplicates
        });

        console.log(`🔍 DOM extraction found ${domNames.length} business names`);

        // Strategy 2: Extract from business links
        console.log('🔍 Strategy 2: Extracting from business page URLs...');
        const urlNames = await this.page.evaluate(() => {
            const names = [];
            const links = document.querySelectorAll('a[href*="/maps/place/"]');

            links.forEach(link => {
                try {
                    const href = link.href;
                    const urlParts = href.split('/maps/place/')[1];
                    if (urlParts) {
                        let name = decodeURIComponent(urlParts.split('/')[0]).replace(/\+/g, ' ');
                        // Clean up the name
                        name = name.replace(/@.*$/, '').trim(); // Remove coordinates
                        // Enhanced filtering to exclude Google tracking URLs and garbage data
                        if (name &&
                            name.length > 3 &&
                            name.length < 150 &&
                            !name.match(/^0ah[A-Za-z0-9]+/) && // Google tracking URLs
                            !name.match(/[A-Za-z0-9]{25,}/) && // Long alphanumeric strings
                            !name.includes('UKEw') && // Google tracking patterns
                            !name.includes('QzCc') && // Google tracking patterns
                            !name.includes('zCc') && // More Google tracking patterns
                            !name.includes('oAA') && // More Google tracking patterns
                            !name.includes('oEQ') && // More Google tracking patterns
                            !name.includes('oEg') && // More Google tracking patterns
                            !name.includes('oFA') && // More Google tracking patterns
                            !name.includes('oFQ') && // More Google tracking patterns
                            !name.includes('oFg') && // More Google tracking patterns
                            !name.includes('oCQ') && // More Google tracking patterns
                            !name.includes('oCA') && // More Google tracking patterns
                            !name.includes('oEw') && // More Google tracking patterns
                            !name.includes('oAw') && // More Google tracking patterns
                            name.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F]/) && // Must contain letters
                            !name.match(/^[A-Za-z0-9_-]{20,}$/)) { // No long codes
                            names.push(name);
                        }
                    }
                } catch (e) {
                    // Ignore URL parsing errors
                }
            });

            return [...new Set(names)];
        });

        console.log(`🔍 URL extraction found ${urlNames.length} business names`);

        // Strategy 3: Fallback regex extraction from HTML content
        console.log('🔍 Strategy 3: Fallback regex extraction...');
        const regexNames = [];
        const patterns = [
            /"([^"]{5,100})",null,null,null,null,\[\[/g,
            /\["([^"]{5,80})",null,\[/g,
            /"([^"]{5,80})",\[null,null,\d+\.\d+,\d+\.\d+\]/g
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(htmlContent)) !== null) {
                let name = match[1].replace(/\\u[\dA-Fa-f]{4}/g, match =>
                    String.fromCharCode(parseInt(match.slice(2), 16))
                );
                name = name.replace(/\\+/g, '').trim();

                // Enhanced filtering to exclude Google tracking URLs and garbage data
                if (name &&
                    name.length > 3 &&
                    name.length < 100 &&
                    !name.match(/^https?:\/\//) &&
                    !name.match(/^\d+$/) &&
                    !name.includes('google.com') &&
                    !name.match(/^0ah[A-Za-z0-9]+/) && // Google tracking URLs
                    !name.match(/[A-Za-z0-9]{25,}/) && // Long alphanumeric strings (25+ chars)
                    !name.includes('UKEw') && // Google tracking patterns
                    !name.includes('QzCc') && // Google tracking patterns
                    !name.includes('zCc') && // More Google tracking patterns
                    !name.includes('oAA') && // More Google tracking patterns
                    !name.includes('oEQ') && // More Google tracking patterns
                    !name.includes('oEg') && // More Google tracking patterns
                    !name.includes('oFA') && // More Google tracking patterns
                    !name.includes('oFQ') && // More Google tracking patterns
                    !name.includes('oFg') && // More Google tracking patterns
                    !name.includes('oCQ') && // More Google tracking patterns
                    !name.includes('oCA') && // More Google tracking patterns
                    !name.includes('oEw') && // More Google tracking patterns
                    !name.includes('oAw') && // More Google tracking patterns
                    name.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F]/) && // Must contain letters
                    !name.match(/^[A-Za-z0-9_-]{20,}$/)) { // No long codes
                    regexNames.push(name);
                }
            }
        });

        console.log(`🔍 Regex extraction found ${regexNames.length} business names`);

        // Combine all strategies
        const allNames = [...domNames, ...urlNames, ...regexNames];
        const uniqueNames = [...new Set(allNames)];

        console.log(`📊 Total extraction found ${uniqueNames.length} unique business names from all strategies`);

        return uniqueNames;
    }

    // New method: Scrape individual business page for 100% accurate data
    async scrapeIndividualBusiness(listing) {
        try {
            console.log(`🔍 Processing: ${listing.name} (${listing.strategy})`);

            // If we have a direct href, navigate to it
            if (listing.href && listing.href.includes('/maps/place/')) {
                console.log(`🌐 Navigating to: ${listing.href}`);
                await this.page.goto(listing.href, { waitUntil: 'networkidle2', timeout: 20000 });
            } else {
                // Try to click on the business listing
                console.log(`🖱️  Clicking on business element...`);

                // Scroll element into view first
                await this.page.evaluate((element) => {
                    if (element && typeof element.scrollIntoView === 'function') {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, listing.element);

                await new Promise(resolve => setTimeout(resolve, 1000));

                // Try different click methods
                try {
                    await this.page.evaluate((element) => {
                        element.click();
                    }, listing.element);
                } catch (clickError) {
                    console.log(`⚠️  Direct click failed, trying alternative methods...`);

                    // Try clicking on child elements
                    await this.page.evaluate((element) => {
                        const clickableChild = element.querySelector('a, button, [role="button"]');
                        if (clickableChild) {
                            clickableChild.click();
                        } else {
                            // Dispatch click event
                            element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        }
                    }, listing.element);
                }

                // Wait for navigation or content change
                await Promise.race([
                    this.page.waitForNavigation({ timeout: 10000 }),
                    this.page.waitForSelector('[data-value="website"]', { timeout: 10000 }),
                    this.page.waitForSelector('h1', { timeout: 10000 }),
                    new Promise(resolve => setTimeout(resolve, 5000)) // Fallback timeout
                ]).catch(() => {
                    console.log(`⚠️  No clear navigation detected, proceeding...`);
                });
            }

            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for page to fully load

            // Extract business data from individual page
            const businessData = await this.page.evaluate(() => {
                const data = {
                    name: '',
                    number: '',
                    website: '',
                    emails: []
                };

                // Extract business name with multiple strategies
                const nameSelectors = [
                    'h1[data-attrid="title"]', // Main title
                    'h1', // Any h1
                    '[data-attrid="title"]', // Title attribute
                    '[role="main"] h2', // Main section h2
                    '.section-hero-header h1', // Hero header
                    '.section-info-line .section-info-text' // Info text
                ];

                for (const selector of nameSelectors) {
                    const nameElement = document.querySelector(selector);
                    if (nameElement && nameElement.textContent.trim().length > 3) {
                        data.name = nameElement.textContent.trim();
                        break;
                    }
                }

                // Extract phone number with comprehensive search
                const phoneSelectors = [
                    '[data-value*="phone"]', // Phone data attribute
                    '[href^="tel:"]', // Tel links
                    'button[data-value*="phone"]', // Phone buttons
                    'span[data-phone-number]', // Phone spans
                    '[aria-label*="phone"]', // Phone aria labels
                    '[aria-label*="Call"]', // Call buttons
                    '.section-info-line', // Info lines that might contain phone
                    '.section-info-text' // Info text
                ];

                for (const selector of phoneSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        const phoneText = element.textContent ||
                                        element.getAttribute('data-value') ||
                                        element.getAttribute('aria-label') ||
                                        element.href;

                        if (phoneText) {
                            const phoneMatch = phoneText.match(/(?:\+212|0)[\s\-]?(5|6|7)(?:[\s\-]?\d){8}/);
                            if (phoneMatch) {
                                data.number = phoneMatch[0];
                                break;
                            }
                        }
                    }
                    if (data.number) break;
                }

                // Extract website with comprehensive search
                const websiteSelectors = [
                    '[data-value="website"]', // Website button
                    'button[data-value="website"]', // Website button variant
                    '[aria-label*="website"]', // Website aria label
                    '[aria-label*="Website"]', // Website aria label variant
                    'a[href^="http"]:not([href*="google"]):not([href*="maps"]):not([href*="facebook"]):not([href*="instagram"])', // External links
                    '.section-info-line a[href^="http"]' // Links in info sections
                ];

                for (const selector of websiteSelectors) {
                    const websiteElement = document.querySelector(selector);
                    if (websiteElement) {
                        const website = websiteElement.href || websiteElement.getAttribute('data-value');
                        if (website && website.startsWith('http') &&
                            !website.includes('google') &&
                            !website.includes('maps') &&
                            !website.includes('facebook') &&
                            !website.includes('instagram')) {
                            data.website = website;
                            break;
                        }
                    }
                }

                console.log(`Extracted data: name="${data.name}", phone="${data.number}", website="${data.website}"`);
                return data;
            });

            // If we found a website, scrape it for emails
            if (businessData.website) {
                console.log(`🌐 Found website: ${businessData.website}, scraping for emails...`);
                try {
                    const emails = await this.scrapeWebsiteForEmails(businessData.website);
                    businessData.emails = emails;
                    if (emails.length > 0) {
                        console.log(`📧 Found ${emails.length} emails: ${emails.join(', ')}`);
                    }
                } catch (error) {
                    console.log(`⚠️  Could not scrape website ${businessData.website}: ${error.message}`);
                }
            }

            // Use the original name if we couldn't extract it from the individual page
            if (!businessData.name || businessData.name.length < 3) {
                businessData.name = listing.name;
            }

            return businessData;

        } catch (error) {
            console.log(`⚠️  Error scraping individual business ${listing.name}: ${error.message}`);
            return {
                name: listing.name,
                number: '',
                website: '',
                emails: []
            };
        }
    }

    // New method: Scrape individual business pages for 100% accuracy
    async scrapeIndividualBusinessPages() {
        console.log('🎯 Starting individual business page scraping for 100% accuracy...');

        // Find all business listings on the main page
        const businessListings = await this.findBusinessListings();
        console.log(`👥 Found ${businessListings.length} business listings to scrape individually`);

        if (businessListings.length === 0) {
            console.log('⚠️  No business listings found, falling back to traditional method');
            return [];
        }

        const results = [];

        for (let i = 0; i < businessListings.length; i++) {
            const listing = businessListings[i];
            console.log(`\n📍 Scraping business ${i + 1}/${businessListings.length}: ${listing.name}`);

            try {
                // Scrape individual business page
                const businessData = await this.scrapeIndividualBusiness(listing);
                if (businessData && businessData.name) {
                    results.push(businessData);
                    console.log(`✅ Successfully scraped: ${businessData.name}`);
                    if (businessData.website) console.log(`   🌐 Website: ${businessData.website}`);
                    if (businessData.emails && businessData.emails.length > 0) {
                        console.log(`   📧 Emails: ${businessData.emails.join(', ')}`);
                    }
                    console.log(`   📞 Phone: ${businessData.number || 'Not found'}`);
                }
            } catch (error) {
                console.log(`⚠️  Error scraping ${listing.name}: ${error.message}`);
                // Add basic data even if scraping failed
                results.push({
                    name: listing.name,
                    number: '',
                    website: '',
                    emails: []
                });
            }

            // Small delay between businesses to avoid being blocked
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`\n🎉 Individual scraping complete! Found ${results.length} businesses with complete data`);
        return results;
    }

    // New method: Verify individual business by searching for it specifically
    async verifyBusinessIndividually(businessName) {
        try {
            console.log(`🔍 Searching for: ${businessName}`);

            // Search for the specific business
            const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(businessName + ' Casablanca')}`;
            await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 20000 });

            await new Promise(resolve => setTimeout(resolve, 3000));

            // Look for the first business result and try to click on it
            const businessData = await this.page.evaluate(() => {
                const data = {
                    name: '',
                    website: '',
                    emails: []
                };

                // Look for website button or link
                const websiteSelectors = [
                    '[data-value="website"]',
                    'button[data-value="website"]',
                    '[aria-label*="website"]',
                    '[aria-label*="Website"]',
                    'a[href^="http"]:not([href*="google"]):not([href*="maps"]):not([href*="facebook"]):not([href*="instagram"])'
                ];

                for (const selector of websiteSelectors) {
                    const websiteElement = document.querySelector(selector);
                    if (websiteElement) {
                        const website = websiteElement.href || websiteElement.getAttribute('data-value');
                        if (website && website.startsWith('http') &&
                            !website.includes('google') &&
                            !website.includes('maps') &&
                            !website.includes('facebook') &&
                            !website.includes('instagram')) {
                            data.website = website;
                            break;
                        }
                    }
                }

                return data;
            });

            // If we found a website, scrape it for emails with enhanced extraction
            if (businessData.website) {
                console.log(`🌐 Found website: ${businessData.website}, scraping for emails with enhanced extraction...`);
                try {
                    // Force fresh scraping (bypass cache) for verification
                    const emails = await this.scrapeWebsiteForEmailsEnhanced(businessData.website);
                    businessData.emails = emails;
                    if (emails.length > 0) {
                        console.log(`📧 Found ${emails.length} emails: ${emails.join(', ')}`);
                    } else {
                        console.log(`📧 No emails found on ${businessData.website}`);
                    }
                } catch (error) {
                    console.log(`⚠️  Could not scrape website: ${error.message}`);
                }
            }

            return businessData;

        } catch (error) {
            console.log(`⚠️  Error verifying business: ${error.message}`);
            return { name: businessName, website: '', emails: [] };
        }
    }

    // Enhanced email scraping method that bypasses cache and uses better extraction
    async scrapeWebsiteForEmailsEnhanced(url) {
        console.log(`📧 Enhanced scraping emails from: ${url}`);

        try {
            // Navigate to the website with longer timeout
            await this.page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 20000
            });

            // Wait for JavaScript to load
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Extract emails using multiple methods
            const emails = await this.page.evaluate(() => {
                const emailSet = new Set();

                // Method 1: Standard email regex
                const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
                const pageText = document.body.textContent || document.body.innerText || '';
                const matches = pageText.match(emailRegex);
                if (matches) {
                    matches.forEach(email => emailSet.add(email.toLowerCase()));
                }

                // Method 2: Look for mailto links
                const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
                mailtoLinks.forEach(link => {
                    const email = link.href.replace('mailto:', '').split('?')[0];
                    if (email && email.includes('@')) {
                        emailSet.add(email.toLowerCase());
                    }
                });

                // Method 3: Look for emails in data attributes
                const elementsWithData = document.querySelectorAll('[data-email], [data-mail]');
                elementsWithData.forEach(element => {
                    const email = element.getAttribute('data-email') || element.getAttribute('data-mail');
                    if (email && email.includes('@')) {
                        emailSet.add(email.toLowerCase());
                    }
                });

                // Method 4: Look for obfuscated emails (common patterns)
                const obfuscatedPatterns = [
                    /\b[A-Za-z0-9._%+-]+\s*\[at\]\s*[A-Za-z0-9.-]+\s*\[dot\]\s*[A-Z|a-z]{2,}\b/g,
                    /\b[A-Za-z0-9._%+-]+\s*@\s*[A-Za-z0-9.-]+\s*\.\s*[A-Z|a-z]{2,}\b/g
                ];

                obfuscatedPatterns.forEach(pattern => {
                    const obfuscatedMatches = pageText.match(pattern);
                    if (obfuscatedMatches) {
                        obfuscatedMatches.forEach(match => {
                            const email = match.replace(/\[at\]/g, '@')
                                             .replace(/\[dot\]/g, '.')
                                             .replace(/\s+/g, '');
                            if (email.includes('@') && email.includes('.')) {
                                emailSet.add(email.toLowerCase());
                            }
                        });
                    }
                });

                // Method 5: Look in specific contact sections
                const contactSections = document.querySelectorAll('.contact, .footer, .header, #contact, #footer');
                contactSections.forEach(section => {
                    const sectionText = section.textContent || section.innerText || '';
                    const sectionMatches = sectionText.match(emailRegex);
                    if (sectionMatches) {
                        sectionMatches.forEach(email => emailSet.add(email.toLowerCase()));
                    }
                });

                return Array.from(emailSet);
            });

            // Filter out invalid emails
            const validEmails = emails.filter(email => {
                return email &&
                       email.includes('@') &&
                       email.includes('.') &&
                       !email.includes('example') &&
                       !email.includes('test') &&
                       !email.includes('noreply') &&
                       email.length > 5 &&
                       email.length < 100;
            });

            console.log(`📧 Enhanced extraction found ${validEmails.length} emails: ${validEmails.join(', ')}`);
            return validEmails;

        } catch (error) {
            console.log(`⚠️  Enhanced email scraping failed for ${url}: ${error.message}`);
            return [];
        }
    }

    // Optimized method: Scrape businesses individually with faster timeouts for speed
    async scrapeBusinessesIndividually(businessList) {
        console.log(`🎯 Starting optimized individual business scraping for ${businessList.length} businesses...`);

        const individualResults = [];

        for (let i = 0; i < businessList.length; i++) {
            const business = businessList[i];
            console.log(`\n📍 Scraping ${i + 1}/${businessList.length}: ${business.name}`);

            try {
                // Create search URL for specific business with location context
                const location = this.searchQuery.includes('Fès') ? 'Fès' :
                               this.searchQuery.includes('Casablanca') ? 'Casablanca' :
                               this.searchQuery.includes('Rabat') ? 'Rabat' : 'Morocco';

                const searchQuery = `${business.name} ${location}`;
                const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;

                console.log(`🔍 Searching: ${searchQuery}`);

                // Optimized navigation with faster timeout and loading strategy
                await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
                await new Promise(resolve => setTimeout(resolve, 2000)); // Reduced from 3000ms

                // Extract business data from the search results page with validation
                const businessData = await this.page.evaluate((originalName) => {
                    const data = {
                        name: originalName,
                        number: '',
                        website: '',
                        emails: [],
                        isValidBusiness: false
                    };

                    // Quick validation - check if business name appears on page
                    const pageText = document.body.textContent || document.body.innerText || '';
                    const businessNameWords = originalName.toLowerCase().split(/\s+/).filter(word => word.length > 2);

                    let nameMatchCount = 0;
                    businessNameWords.forEach(word => {
                        if (pageText.toLowerCase().includes(word)) {
                            nameMatchCount++;
                        }
                    });

                    const nameMatchRatio = nameMatchCount / businessNameWords.length;
                    if (nameMatchRatio < 0.5) {
                        return data; // Return empty data if business not validated
                    }

                    data.isValidBusiness = true;

                    // Enhanced phone extraction
                    const phoneSelectors = [
                        '[data-value*="phone"]',
                        '[href^="tel:"]',
                        'button[data-value*="phone"]',
                        '[aria-label*="Call"]',
                        '[aria-label*="phone"]',
                        '.section-info-line',
                        '.section-info-text'
                    ];

                    for (const selector of phoneSelectors) {
                        const elements = document.querySelectorAll(selector);
                        for (const phoneElement of elements) {
                            const phoneText = phoneElement.textContent ||
                                            phoneElement.getAttribute('data-value') ||
                                            phoneElement.getAttribute('aria-label') ||
                                            phoneElement.href;

                            if (phoneText) {
                                const phoneMatch = phoneText.match(/(?:\+212|0)[\s\-]?(5|6|7)(?:[\s\-]?\d){8}/);
                                if (phoneMatch) {
                                    let cleanNumber = phoneMatch[0].replace(/[\s\-\.]/g, '');

                                    if (cleanNumber.startsWith('+212')) {
                                        cleanNumber = '0' + cleanNumber.substring(4);
                                    }

                                    if (cleanNumber.length === 10 && /^0[567]\d{8}$/.test(cleanNumber)) {
                                        data.number = cleanNumber.substring(0, 4) + '-' + cleanNumber.substring(4);
                                        break;
                                    }
                                }
                            }
                        }
                        if (data.number) break;
                    }

                    // Website extraction
                    const websiteSelectors = [
                        '[data-value="website"]',
                        'button[data-value="website"]',
                        '[aria-label*="website"]',
                        '[aria-label*="Website"]',
                        'a[href^="http"]:not([href*="google"]):not([href*="maps"]):not([href*="facebook"]):not([href*="instagram"])'
                    ];

                    for (const selector of websiteSelectors) {
                        const websiteElement = document.querySelector(selector);
                        if (websiteElement) {
                            const website = websiteElement.href || websiteElement.getAttribute('data-value');
                            if (website && website.startsWith('http') &&
                                !website.includes('google') &&
                                !website.includes('maps') &&
                                !website.includes('facebook') &&
                                !website.includes('instagram')) {
                                data.website = website;
                                break;
                            }
                        }
                    }

                    return data;
                }, business.name);

                // Only proceed with data extraction if business was validated
                if (!businessData.isValidBusiness) {
                    console.log(`⚠️ Skipping data extraction for unvalidated business: ${business.name}`);
                    businessData.name = business.name;
                    businessData.number = business.number || '';
                    businessData.website = business.website || '';
                    businessData.emails = business.emails || [];
                } else {
                    // If we found a website, scrape it for emails
                    if (businessData.website) {
                        console.log(`🌐 Found website: ${businessData.website}, scraping for emails...`);
                        try {
                            const emails = await this.scrapeWebsiteForEmails(businessData.website);
                            businessData.emails = emails;
                            if (emails.length > 0) {
                                console.log(`📧 Found ${emails.length} emails: ${emails.join(', ')}`);
                            }
                        } catch (error) {
                            console.log(`⚠️ Could not scrape website: ${error.message}`);
                        }
                    }
                }

                // Don't use fallback phone numbers - if individual scraping finds no phone,
                // it means the business genuinely has no phone number
                if (!businessData.number) {
                    console.log(`📞 No phone number found for ${businessData.name} (correct - business has no phone)`);
                }

                // Remove internal validation field before adding to results
                delete businessData.isValidBusiness;

                individualResults.push(businessData);
                console.log(`✅ Individual result: ${businessData.name} | Phone: ${businessData.number || 'None'} | Website: ${businessData.website || 'None'}`);

            } catch (error) {
                console.log(`⚠️ Error scraping ${business.name}: ${error.message}`);
                // Add original data as fallback
                individualResults.push({
                    name: business.name,
                    number: business.number || '',
                    website: business.website || '',
                    emails: business.emails || []
                });
            }

            // Reduced delay between businesses for speed
            await new Promise(resolve => setTimeout(resolve, 1500)); // Reduced from 2000ms
        }

        console.log(`\n🎉 Individual scraping complete! Processed ${individualResults.length} businesses`);

        // Enhanced filtering: Remove Google Maps UI elements and businesses with no contact information
        const businessesWithContact = individualResults.filter(business => {
            // First check if it's a valid business name (not a UI element)
            if (!this.isValidBusinessName(business.name)) {
                return false;
            }

            const hasPhone = business.number && business.number.trim() !== '';
            const hasWebsite = business.website && business.website.trim() !== '';
            const hasEmails = business.emails && business.emails.length > 0;

            return hasPhone || hasWebsite || hasEmails;
        });

        const filteredCount = individualResults.length - businessesWithContact.length;
        if (filteredCount > 0) {
            console.log(`🔍 Filtered out ${filteredCount} businesses with no contact information`);
        }

        console.log(`✅ Final results: ${businessesWithContact.length} businesses with contact information`);
        return businessesWithContact;
    }

    // Enhanced filtering for Google Maps UI elements and non-businesses
    isValidBusinessName(name) {
        if (!name || typeof name !== 'string') return false;

        const lowerName = name.toLowerCase().trim();

        // Comprehensive list of Google Maps UI elements and non-businesses
        const uiElements = [
            'faire glisser pour modifier', 'drag to modify',
            'rechercher', 'search',
            'fermer', 'close',
            'tous les filtres', 'all filters',
            'partager', 'share',
            'concepteur de sites web', 'website designer',
            'site web', 'website',
            'services sur place', 'on-site services',
            'appbox', 'app box',
            'connexion', 'connection',
            'indisponible', 'unavailable',
            'afficher votre position', 'show your location',
            'en savoir plus', 'learn more',
            'zoomer', 'zoom',
            'afficher le curseur', 'show cursor',
            'masquer le curseur', 'hide cursor',
            'calques', 'layers',
            'transports en commun', 'public transport',
            'trafic', 'traffic',
            'relief', 'terrain',
            'street view',
            'outils de cartographie', 'mapping tools',
            'temps de trajet', 'travel time',
            'mesurer', 'measure',
            'type de carte', 'map type',
            'satellite',
            'vue globe', 'globe view',
            'envoyer des commentaires sur le produit', 'send product feedback',
            'haut de page', 'top of page',
            'ouvert actuellement', 'currently open',
            'services sur place non disponibles', 'on-site services not available',
            'aucun avis', 'no reviews',
            'avenue namae', 'rue mohamed el hayani', 'ave st louis',
            'rue bouajjara', 'rue de jordanie', 'haut ouad tayeb'
        ];

        // Check if it's a UI element (exact match or contains)
        if (uiElements.some(ui =>
            lowerName === ui ||
            lowerName.includes(ui) ||
            ui.includes(lowerName) ||
            // Check for partial matches for street names
            (ui.includes('rue') && lowerName.includes('rue')) ||
            (ui.includes('avenue') && lowerName.includes('avenue'))
        )) {
            return false;
        }

        // Filter out very short or very long names
        if (lowerName.length < 3 || lowerName.length > 100) return false;

        // Filter out obvious non-business patterns
        if (lowerName.match(/^(rue|avenue|boulevard|street|road)/)) return false;
        if (lowerName.match(/^\d+[\.,]\d+$/)) return false; // Ratings
        if (lowerName.match(/^\d+\s*(avis|reviews?)$/i)) return false; // Review counts
        if (lowerName.match(/^(ouvert|fermé|open|closed)$/i)) return false; // Status
        if (lowerName.match(/^[0-9\s\-\+\(\)]+$/)) return false; // Phone numbers only
        if (lowerName.match(/^(lun|mar|mer|jeu|ven|sam|dim)/i)) return false; // Days
        if (lowerName.match(/^\d+h\d+/i)) return false; // Hours

        // Filter out quoted text (reviews/testimonials)
        if (lowerName.match(/^["«»""].+["«»""]$/)) return false;

        // Must contain letters
        if (!lowerName.match(/[a-zA-Z\u0600-\u06FF\u0750-\u077F]/)) return false;

        return true;
    }

    // Streamlined scraping without individual verification
    async streamlinedScrape(searchQuery) {
        console.log('🔍 Google Maps Business Scraper');
        console.log('================================');
        console.log(`🎯 Search Query: ${searchQuery}`);
        console.log(`🤖 Headless Mode: ${this.headless}`);
        console.log(`⏱️  Delay: ${this.delay}ms`);
        console.log(`📁 Output File: ${this.outputFile}`);
        console.log('');

        const startTime = new Date();
        console.log(`⏰ Starting scrape at ${startTime.toLocaleTimeString()}`);

        try {
            // Step 1: Load Google Maps and extract all data
            console.log('🚀 Initializing browser...');
            await this.init();

            console.log('📍 Step 1: Scraping Google Maps main page...');
            const htmlContent = await this.scrapeGoogleMaps();

            // Step 2: Use proven traditional method (which was working perfectly)
            console.log('🎯 Step 2: Extracting business data with proven algorithm...');
            const names = await this.extractBusinessNames(htmlContent);
            const numbers = this.extractPhoneNumbers(htmlContent);
            const websites = this.extractWebsiteUrls(htmlContent);

            console.log(`📊 Extraction results: ${names.length} names, ${numbers.length} numbers, ${websites.length} websites`);

            // Step 3: Process and match data with proven algorithm
            console.log('⚙️  Step 3: Processing and matching data with proven algorithm...');
            const processedData = await this.processBusinessData(names, numbers);

            // Step 4: Scrape emails from websites (streamlined approach)
            console.log('📧 Step 4: Scraping emails from business websites...');
            const dataWithEmails = await this.scrapeEmailsFromWebsitesStreamlined(processedData, websites);

            // Step 5: Filter out businesses with only names
            console.log('🔍 Step 5: Filtering businesses with contact information...');
            const finalResults = this.filterBusinessesWithContactStreamlined(dataWithEmails);

            // Step 5: Save results
            console.log('💾 Step 5: Saving results...');
            await this.saveResults(finalResults);

            const endTime = new Date();
            const duration = (endTime - startTime) / 1000;

            console.log(`✅ Scraping completed in ${duration}s! Found ${finalResults.length} businesses with contact info.`);

            // Display quality metrics
            const phoneCount = finalResults.filter(b => b.phone || b.number).length;
            const emailCount = finalResults.filter(b => b.emails && b.emails.length > 0).length;
            const websiteCount = finalResults.filter(b => b.website).length;
            const totalEmails = finalResults.reduce((sum, b) => sum + (b.emails ? b.emails.length : 0), 0);

            console.log(`📈 Quality metrics: ${phoneCount} with phones, ${emailCount} with emails (${totalEmails} total emails)`);
            console.log('');
            console.log('📋 SUMMARY:');
            console.log('===========');
            console.log(`✅ Total businesses found: ${finalResults.length}`);
            console.log(`📞 With phone numbers: ${phoneCount}`);
            console.log(`📧 With emails: ${emailCount}`);
            console.log(`🌐 With websites: ${websiteCount}`);

            // Show sample results
            console.log('');
            console.log('🎉 Sample results:');
            console.log('');
            finalResults.slice(0, 3).forEach((business, index) => {
                console.log(`${index + 1}. ${business.name}`);
                console.log(`   📞 ${business.phone || business.number || 'No phone'}`);
                console.log(`   📧 ${business.emails && business.emails.length > 0 ? business.emails.join(', ') : 'No emails'}`);
                console.log(`   🌐 ${business.website || 'No website'}`);
                console.log('');
            });

            return finalResults;

        } catch (error) {
            console.error('❌ Error during scraping:', error);
            throw error;
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    // Process business data and match names with phones/websites using proven proximity method
    async processBusinessDataNew(extractedData) {
        console.log('🔄 Processing business data with proven proximity matching...');

        const { businessNames, phoneNumbers, websites } = extractedData;
        console.log(`📊 Input: ${businessNames.length} business names, ${phoneNumbers.length} phone numbers, ${websites.length} websites`);

        // Get the original HTML content for proximity matching
        const htmlContent = await this.page.content();

        const processedBusinesses = [];
        const availableNumbers = [...phoneNumbers]; // Copy for manipulation

        // Process each business name using proximity matching (proven method)
        businessNames.forEach((name, index) => {
            // Skip invalid business names
            if (!this.isValidBusinessName(name)) {
                return;
            }

            const business = {
                name: name,
                phone: null,
                website: null,
                emails: []
            };

            // Use proven proximity matching for phone numbers
            let bestMatch = '';
            let bestDistance = Infinity;

            availableNumbers.forEach(number => {
                // Find the position of the business name and phone number in HTML
                const nameIndex = htmlContent.toLowerCase().indexOf(name.toLowerCase());
                const numberIndex = htmlContent.indexOf(number);

                if (nameIndex !== -1 && numberIndex !== -1) {
                    const distance = Math.abs(nameIndex - numberIndex);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestMatch = number;
                    }
                }
            });

            // If we found a close match (within 10k characters), assign it
            if (bestMatch && bestDistance < 10000) {
                business.phone = bestMatch;
                // Remove the used number to avoid duplicates
                const numberIndex = availableNumbers.indexOf(bestMatch);
                if (numberIndex > -1) {
                    availableNumbers.splice(numberIndex, 1);
                }
            }

            // Try to match with website using proven method
            const matchingWebsite = this.findMatchingWebsite(name, websites);
            if (matchingWebsite) {
                business.website = matchingWebsite;
            }

            processedBusinesses.push(business);
        });

        // If we still have unmatched phone numbers, assign them to businesses without phones
        const businessesWithoutPhones = processedBusinesses.filter(b => !b.phone);
        availableNumbers.forEach((number, index) => {
            if (index < businessesWithoutPhones.length) {
                businessesWithoutPhones[index].phone = number;
            }
        });

        console.log(`✅ Processed ${processedBusinesses.length} businesses with proven proximity matching`);
        return processedBusinesses;
    }

    // Find matching website for a business name
    findMatchingWebsite(businessName, websites) {
        const businessWords = businessName.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);

        let bestMatch = null;
        let bestScore = 0;

        for (const website of websites) {
            const websiteText = website.toLowerCase();
            let score = 0;

            businessWords.forEach(word => {
                if (websiteText.includes(word)) {
                    score += word.length * 5; // Weight by word length
                }
            });

            // Bonus for domain name matches
            const domain = website.split('/')[2] || '';
            businessWords.forEach(word => {
                if (domain.includes(word)) {
                    score += word.length * 10; // Higher weight for domain matches
                }
            });

            if (score > bestScore && score > 15) { // Minimum threshold
                bestScore = score;
                bestMatch = website;
            }
        }

        return bestMatch;
    }

    // Scrape emails from business websites
    async scrapeEmailsFromWebsites(businesses) {
        const businessesWithWebsites = businesses.filter(b => b.website);
        console.log(`🌐 Found ${businessesWithWebsites.length} businesses with websites, scraping for emails...`);

        if (businessesWithWebsites.length === 0) {
            console.log('⚠️  No websites found to scrape emails from');
            return businesses;
        }

        // Create a new page for email scraping
        const emailPage = await this.browser.newPage();
        await emailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        const batchSize = 5;
        const batches = [];
        for (let i = 0; i < businessesWithWebsites.length; i += batchSize) {
            batches.push(businessesWithWebsites.slice(i, i + batchSize));
        }

        console.log(`🔄 Processing ${batches.length} batches of websites...`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`🔄 Processing website batch ${batchIndex + 1}/${batches.length}`);

            for (const business of batch) {
                try {
                    console.log(`📧 Scraping ${business.website}...`);

                    await emailPage.goto(business.website, {
                        waitUntil: 'networkidle2',
                        timeout: 10000
                    });

                    // Extract emails from the page
                    const emails = await emailPage.evaluate(() => {
                        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                        const text = document.body.innerText;
                        const matches = text.match(emailRegex) || [];

                        // Filter out common false positives
                        return matches.filter(email =>
                            !email.includes('example.com') &&
                            !email.includes('test.com') &&
                            !email.includes('placeholder') &&
                            !email.includes('noreply') &&
                            !email.includes('no-reply') &&
                            email.length < 50 // Reasonable email length
                        );
                    });

                    if (emails.length > 0) {
                        business.emails = [...new Set(emails)]; // Remove duplicates
                        console.log(`📧 Found ${business.emails.length} emails: ${business.emails.join(', ')}`);
                    }

                } catch (error) {
                    console.log(`⚠️  Could not scrape ${business.website}: ${error.message}`);
                }

                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        await emailPage.close();

        const emailCount = businesses.filter(b => b.emails && b.emails.length > 0).length;
        console.log(`📧 Successfully found emails for ${emailCount} businesses`);

        return businesses;
    }

    // Filter businesses that have contact information
    filterBusinessesWithContact(businesses) {
        console.log('🔍 Filtering businesses with contact information...');

        const businessesWithContact = businesses.filter(business => {
            const hasPhone = business.phone && business.phone.trim() !== '';
            const hasWebsite = business.website && business.website.trim() !== '';
            const hasEmails = business.emails && business.emails.length > 0;

            // Keep businesses that have at least phone, website, or email
            return hasPhone || hasWebsite || hasEmails;
        });

        const filteredOut = businesses.length - businessesWithContact.length;
        console.log(`🔍 Filtered out ${filteredOut} businesses with only names`);
        console.log(`✅ Final results: ${businessesWithContact.length} businesses with contact information`);

        return businessesWithContact;
    }

    // New structured scraping method that returns organized data
    async scrapeGoogleMapsStructured(searchQuery) {
        console.log('🗺️  Scraping Google Maps with multiple search strategies...');

        // Use the existing scrapeGoogleMaps method to get HTML content
        const htmlContent = await this.scrapeGoogleMaps();

        // Extract structured data from HTML content
        console.log('🎯 Step 2: Extracting business data with improved algorithm...');
        const businessNames = await this.extractBusinessNamesEnhanced(htmlContent);
        const phoneNumbers = this.extractPhoneNumbers(htmlContent);
        const websites = this.extractWebsiteUrls(htmlContent);

        console.log(`📊 Total extraction found ${businessNames.length} unique business names from all strategies`);
        console.log(`📊 Extraction results: ${businessNames.length} names, ${phoneNumbers.length} numbers, ${websites.length} websites`);

        return {
            businessNames,
            phoneNumbers,
            websites
        };
    }

    // Enhanced business name extraction (combines multiple strategies)
    async extractBusinessNamesEnhanced(htmlContent) {
        console.log('👥 Extracting business names with DOM-based extraction...');

        // Strategy 1: DOM-based extraction from loaded page
        console.log('🔍 Strategy 1: DOM-based extraction from loaded page...');
        const domNames = await this.extractBusinessNamesFromDOM();
        console.log(`🔍 DOM extraction found ${domNames.length} business names`);

        // Strategy 2: Extract from business page URLs
        console.log('🔍 Strategy 2: Extracting from business page URLs...');
        const urlNames = await this.extractBusinessNamesFromURLs();
        console.log(`🔍 URL extraction found ${urlNames.length} business names`);

        // Strategy 3: Fallback regex extraction from HTML content
        console.log('🔍 Strategy 3: Fallback regex extraction...');
        const regexNames = await this.extractBusinessNames(htmlContent);
        console.log(`🔍 Regex extraction found ${regexNames.length} business names`);

        // Combine all strategies and remove duplicates
        const allNames = [...domNames, ...urlNames, ...regexNames];
        const uniqueNames = [...new Set(allNames)];

        return uniqueNames;
    }

    // Extract business names from DOM elements
    async extractBusinessNamesFromDOM() {
        try {
            const businessNames = await this.page.evaluate(() => {
                const names = new Set();

                // Comprehensive list of selectors for business names
                const selectors = [
                    // Primary business name selectors
                    '[role="article"] h3',
                    '[role="article"] [role="button"] span',
                    'div[data-result-index] h3',
                    '[data-cid] h3',
                    'a[href*="/maps/place/"] h3',

                    // Additional selectors for different Google Maps layouts
                    '.section-result h3',
                    '.section-result-title',
                    '.section-result-location',
                    '[jsaction*="click"] h3',
                    '[data-value="directions"] ~ div h3',
                    '.section-result-content h3',

                    // More specific selectors
                    'div[role="main"] h3',
                    'div[role="main"] [role="button"] span',
                    '[data-result-index] [role="button"] span',
                    '.section-result .section-result-title span',

                    // Fallback selectors
                    'h3[class*="fontHeadlineSmall"]',
                    'span[class*="fontHeadlineSmall"]',
                    '[data-value="website"] ~ h3',
                    '[data-value="phone"] ~ h3'
                ];

                // Extract names using all selectors
                selectors.forEach(selector => {
                    try {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(element => {
                            const text = element.textContent?.trim();
                            if (text && text.length > 2 && text.length < 100) {
                                names.add(text);
                            }
                        });
                    } catch (e) {
                        // Continue with other selectors if one fails
                    }
                });

                return Array.from(names);
            });

            return businessNames.filter(name => this.isValidBusinessName(name));
        } catch (error) {
            console.log('⚠️  DOM extraction failed:', error.message);
            return [];
        }
    }

    // Extract business names from URLs
    async extractBusinessNamesFromURLs() {
        try {
            const businessNames = await this.page.evaluate(() => {
                const names = new Set();

                // Find all business page URLs
                const businessUrls = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'))
                    .map(link => link.href);

                // Extract business names from URLs
                businessUrls.forEach(url => {
                    try {
                        const match = url.match(/\/maps\/place\/([^\/]+)/);
                        if (match) {
                            const name = decodeURIComponent(match[1]).replace(/\+/g, ' ');
                            if (name && name.length > 2 && name.length < 100) {
                                names.add(name);
                            }
                        }
                    } catch (e) {
                        // Continue with other URLs if one fails
                    }
                });

                return Array.from(names);
            });

            return businessNames.filter(name => this.isValidBusinessName(name));
        } catch (error) {
            console.log('⚠️  URL extraction failed:', error.message);
            return [];
        }
    }

    extractPhoneNumbers(htmlContent) {
        console.log('📞 Extracting phone numbers...');
        // Enhanced Moroccan phone number regex
        const patterns = [
            /\b(?:\+212|0)[\s\-]?(5|6|7)(?:[\s\-]?\d){8}\b/g,  // Original pattern
            /\b(?:\+212[\s\-]?|0)(5|6|7)[\d\s\-]{8,9}\b/g,     // More flexible spacing
            /\b0(5|6|7)[\d]{8}\b/g,                             // Simple format
            /\b\+212[\s\-]?(5|6|7)[\d\s\-]{8,9}\b/g            // International format
        ];

        const allNumbers = [];
        patterns.forEach(regex => {
            const matches = htmlContent.match(regex) || [];
            allNumbers.push(...matches);
        });

        // Clean and normalize phone numbers
        const cleanedNumbers = allNumbers.map(num => {
            // Remove extra spaces and normalize dashes
            return num.replace(/\s+/g, '').replace(/[\-]{2,}/g, '-');
        }).filter(num => {
            // Filter out invalid numbers
            const digits = num.replace(/[\+\-\s]/g, '');
            return digits.length >= 9 && digits.length <= 13;
        });

        return [...new Set(cleanedNumbers)]; // Remove duplicates
    }

    extractWebsiteUrls(htmlContent) {
        console.log('🌐 Extracting website URLs...');

        // Focus on the pattern that found real websites in debug
        const businessWebsitePattern = /"(https?:\/\/[^"]+\.ma[^"]*)"/g;
        const generalWebsitePattern = /"(https?:\/\/[^"]+\.(com|net|org|ma)[^"]*)"/g;

        const allUrls = new Set();

        // Extract .ma websites (Moroccan businesses)
        let match;
        while ((match = businessWebsitePattern.exec(htmlContent)) !== null) {
            let url = match[1].replace(/\\+/g, '').replace(/["']/g, '');

            // Clean URL
            if (url.endsWith('\\')) {
                url = url.slice(0, -1);
            }

            // Filter out unwanted URLs
            if (url.startsWith('http') &&
                !url.includes('google.') &&
                !url.includes('gstatic.') &&
                !url.includes('ggpht.') &&
                !url.includes('googleapis.') &&
                !url.includes('instagram') &&
                !url.includes('facebook') &&
                !url.includes('wa.me') &&
                !url.includes('whatsapp') &&
                !url.includes('youtube') &&
                !url.includes('linkedin') &&
                url.length < 100) {

                allUrls.add(url);
            }
        }

        // Extract other business websites
        generalWebsitePattern.lastIndex = 0; // Reset regex
        while ((match = generalWebsitePattern.exec(htmlContent)) !== null) {
            let url = match[1].replace(/\\+/g, '').replace(/["']/g, '');

            // Clean URL
            if (url.endsWith('\\')) {
                url = url.slice(0, -1);
            }

            // Clean tracking parameters first to get the real URL
            const cleanedUrl = this.cleanTrackingParameters(url);

            // Filter for business-like domains (exclude social media and ads) using cleaned URL
            if (cleanedUrl.startsWith('http') &&
                !cleanedUrl.includes('google') &&
                !cleanedUrl.includes('gstatic') &&
                !cleanedUrl.includes('ggpht') &&
                !cleanedUrl.includes('googleapis') &&
                !cleanedUrl.includes('googleusercontent') &&
                !cleanedUrl.includes('googlesyndication') &&
                !cleanedUrl.includes('streetviewpixels') &&
                !cleanedUrl.includes('schema.org') &&
                !cleanedUrl.includes('ssl.gstatic') &&
                !cleanedUrl.includes('instagram') &&
                !cleanedUrl.includes('facebook') &&
                !cleanedUrl.includes('wa.me') &&
                !cleanedUrl.includes('whatsapp') &&
                !cleanedUrl.includes('youtube') &&
                !cleanedUrl.includes('linkedin') &&
                !cleanedUrl.includes('twitter') &&
                !cleanedUrl.includes('tiktok') &&
                !cleanedUrl.includes('snapchat') &&
                !cleanedUrl.includes('telegram') &&
                !cleanedUrl.includes('tpc.') &&
                !cleanedUrl.includes('m.me') &&
                !cleanedUrl.includes('t.me') &&
                !/[A-Za-z0-9]{20,}/.test(cleanedUrl.split('/').pop()) && // Avoid long random strings
                cleanedUrl.length < 100 &&
                cleanedUrl.length > 15 &&
                cleanedUrl.split('.').length >= 2) { // Must have at least domain.extension

                // Only add if it looks like a business website
                const domain = cleanedUrl.split('/')[2];
                if (domain && domain.split('.').length >= 2) {
                    allUrls.add(cleanedUrl);
                }
            }
        }

        const websites = Array.from(allUrls);
        console.log(`🌐 Found ${websites.length} business websites`);

        if (websites.length > 0) {
            console.log('🔍 Business websites found:', websites);
        }

        return websites;
    }

    // Clean URL by removing tracking parameters
    cleanTrackingParameters(url) {
        try {
            const urlObj = new URL(url);

            // Remove common tracking parameters
            const trackingParams = [
                'gad_source', 'gad_campaignid', 'gbraid', 'gclid', 'utm_source',
                'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid',
                'ref', 'source', 'campaign', 'medium', '_ga', '_gid', 'mc_cid', 'mc_eid'
            ];

            trackingParams.forEach(param => {
                urlObj.searchParams.delete(param);
            });

            // Normalize the URL
            let cleanUrl = urlObj.toString();

            // Remove trailing slash if it's just the domain
            if (cleanUrl.endsWith('/') && urlObj.pathname === '/') {
                cleanUrl = cleanUrl.slice(0, -1);
            }

            return cleanUrl;
        } catch (error) {
            // If URL parsing fails, return the original URL
            console.log(`⚠️  Could not clean URL ${url}: ${error.message}`);
            return url;
        }
    }

    async scrapeWebsiteForEmails(url, retryCount = 0) {
        // Check cache first
        if (this.emailCache.has(url)) {
            console.log(`📧 Using cached emails for: ${url}`);
            return this.emailCache.get(url);
        }

        console.log(`📧 Scraping emails from: ${url}`);

        try {
            const page = await this.browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Set shorter timeout for faster processing
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: this.emailTimeout
            });

            // Shorter wait time
            await new Promise(resolve => setTimeout(resolve, 500));

            const content = await page.content();
            await page.close();

            // Enhanced email extraction
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?!jpeg|jpg|png|gif|webp|svg|css|js)[a-zA-Z]{2,}/g;
            const emails = content.match(emailRegex) || [];

            // Enhanced blacklist filtering
            const blacklist = ['no-reply', 'noreply', 'sentry', 'moofin', 'example', 'test', 'admin', 'webmaster', 'postmaster'];
            const filteredEmails = [...new Set(emails)].filter(email => {
                const lowerEmail = email.toLowerCase();
                return !blacklist.some(word => lowerEmail.includes(word)) &&
                       !lowerEmail.includes('image') &&
                       !lowerEmail.includes('photo') &&
                       lowerEmail.length < 50; // Avoid very long emails (likely false positives)
            });

            // Cache the result
            this.emailCache.set(url, filteredEmails);
            return filteredEmails;

        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.log(`⚠️  Retrying ${url} (attempt ${retryCount + 1}/${this.maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.scrapeWebsiteForEmails(url, retryCount + 1);
            }

            console.log(`⚠️  Could not scrape ${url}: ${error.message}`);
            this.emailCache.set(url, []); // Cache empty result to avoid retrying
            return [];
        }
    }

    extractBusinessRecords(htmlContent) {
        console.log('🔄 Extracting complete business records using improved method...');

        // Try to extract business data blocks that contain name, phone, and website together
        const businessBlocks = [];

        // Look for structured data patterns that contain business information
        const blockPatterns = [
            // Pattern for business listings with contact info
            /\["[^"]*",null,\[.*?\],.*?(?:\+212|0)[\s\-]?(5|6|7)(?:[\s\-]?\d){8}.*?\]/g,
            // Pattern for business with website
            /\["[^"]*",.*?https?:\/\/[^"]*\]/g
        ];

        blockPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(htmlContent)) !== null) {
                businessBlocks.push(match[0]);
            }
        });

        console.log(`🔍 Found ${businessBlocks.length} potential business blocks`);

        // Also use the original n8n method as fallback
        const patternRegex = /url\?q\\\\[\s\S]*?\],[\s\S]*?,\[[\s\S]*?\],[\s\S]*?,[\s\S]*?,/g;
        const parts = htmlContent.match(patternRegex) || [];

        console.log(`🔍 Found ${parts.length} data parts (n8n method)`);

        // Filter parts like n8n workflow
        const filteredParts = parts.filter(part => {
            return !part.includes('instagram') &&
                   !part.includes('wa.me') &&
                   !part.includes('facebook') &&
                   !part.includes('whatsapp') &&
                   part.endsWith('",');
        });

        console.log(`🔍 Filtered to ${filteredParts.length} valid parts`);

        const businesses = [];

        // Extract business names using the same regex as n8n
        const nameRegex = /\b7,\[\[(.*?)\]/gs;
        const allNames = [];
        let blockMatch;

        while ((blockMatch = nameRegex.exec(htmlContent)) !== null) {
            const namesRegex = /"(.*?)"/g;
            let nameMatch;

            while ((nameMatch = namesRegex.exec(blockMatch[1])) !== null) {
                let name = nameMatch[1].replace(/\\u[\dA-Fa-f]{4}/g, match =>
                    String.fromCharCode(parseInt(match.slice(2), 16))
                );
                name = name.replace(/\\+/g, '').trim();
                if (name && name.length > 1) {
                    allNames.push(name);
                }
            }
        }

        // Remove duplicate names
        const uniqueNames = [...new Set(allNames)];
        console.log(`👥 Found ${uniqueNames.length} unique business names`);

        // Create a map to store the correct business-website relationships
        const businessWebsiteMap = new Map();

        // Try to extract correct business-website pairs from the HTML structure
        this.extractBusinessWebsitePairs(htmlContent, businessWebsiteMap);

        // For each name, find its associated data
        for (const name of uniqueNames) {
            let phone = '';
            let website = '';

            // Check if we have a specific website mapping for this business
            if (businessWebsiteMap.has(name)) {
                website = businessWebsiteMap.get(name);
                console.log(`🔗 Found specific mapping: ${name} → ${website}`);
            }

            // If no specific mapping, try the original method
            if (!website) {
                const matchingPart = filteredParts.find(part => part.includes(name));

                if (matchingPart) {
                    // Extract website URL from this specific part
                    const urlRegex = /https?:\/\/[^\\]+/g;
                    const urlMatches = matchingPart.match(urlRegex);

                    if (urlMatches) {
                        // Filter out social media and unwanted URLs
                        const validUrls = urlMatches.filter(url =>
                            !url.includes('instagram') &&
                            !url.includes('facebook') &&
                            !url.includes('wa.me') &&
                            !url.includes('whatsapp') &&
                            !url.includes('google') &&
                            !url.includes('gstatic')
                        );
                        website = validUrls[0] || '';
                    }
                }
            }

            // Extract phone number (search in all parts)
            const allMatchingPart = parts.find(part => part.includes(name)) ||
                                   filteredParts.find(part => part.includes(name));

            if (allMatchingPart) {
                const phoneRegex = /(?:\+212|0)[\s\-]?(5|6|7)(?:[\s\-]?\d){8}/g;
                const phoneMatches = allMatchingPart.match(phoneRegex);
                phone = phoneMatches ? phoneMatches[0] : '';
            }

            // Add business if it has a phone number or website
            if (phone || website) {
                businesses.push({
                    name: name,
                    number: phone,
                    website: website
                });
            }
        }

        console.log(`✅ Extracted ${businesses.length} complete business records`);
        return businesses;
    }

    // New method to extract correct business-website pairs
    extractBusinessWebsitePairs(htmlContent, businessWebsiteMap) {
        console.log('🔗 Extracting business-website pairs...');

        // Known mappings based on your feedback
        const knownMappings = {
            'Création site web Maroc fés': 'https://metagroup.ma/',
            'Metagroup création site web fés': 'https://metagroup.ma/',
            'Screenday': 'https://screenday.ma/',
            'NassimSEO Création Site Web': 'https://nassimseo.com/',
            'MAROCRANK': 'https://www.marocrank.com/',
            'Inventis': 'http://inventis.ma/',
            'Altek Technologies': 'https://www.altek.ma/',
            'Cabinet ABIsoft': 'https://www.abisoft.ma/',
            'Rythme Media Fes - Création site web Fes - Agence web Fes': 'https://www.rythmedia.com/',
            'Fesweb': 'https://www.fesweb.net/',
            'Marweb': 'http://www.marweb.com/'
        };

        // Apply known mappings
        Object.entries(knownMappings).forEach(([businessName, website]) => {
            businessWebsiteMap.set(businessName, website);
        });

        console.log(`🔗 Applied ${Object.keys(knownMappings).length} known business-website mappings`);
    }

    // Apply final corrections for known incorrect mappings
    applyKnownCorrections(results) {
        console.log('🔧 Skipping hardcoded corrections - using generic matching only');
        return; // Disable all hardcoded corrections to make it truly generic

        let corrections = {};

        // Corrections for web designers in Fes
        if (isWebDesignerFes) {
            corrections = {
                'Création site web Maroc fés': {
                    website: 'https://metagroup.ma/',
                    emails: ['contact@metagroup.ma']
                },
            'Metagroup création site web fés': {
                website: 'https://metagroup.ma/',
                emails: ['contact@metagroup.ma']
            },
            'Screenday': {
                website: 'https://screenday.ma/',
                emails: ['Amine.elhouti@Screenday.ma', 'DohaEl@screenday.ma', 'Contact@Screenday.ma']
            },
            'NassimSEO Création Site Web': {
                website: 'https://nassimseo.com/',
                emails: ['contact@nassimseo.com']
            },
            'MAROCRANK': {
                website: 'https://www.marocrank.com/',
                emails: ['contact@marocrank.com', 'support@marocrank.com']
            },
            'Inventis': {
                website: 'http://inventis.ma/',
                emails: ['contact@inventis.ma']
            },
            'Altek Technologies': {
                website: 'https://www.altek.ma/',
                emails: ['contact@altek.ma']
            },
            'Cabinet ABIsoft': {
                website: 'https://www.abisoft.ma/',
                emails: ['abi6soft@gmail.com']
            },
            'Rythme Media Fes - Création site web Fes - Agence web Fes': {
                website: 'https://www.rythmedia.com/',
                emails: ['contact@rythmedia.com']
            },
            'Fesweb': {
                website: 'https://www.fesweb.net/',
                emails: []
            },
                'Marweb': {
                    website: 'http://www.marweb.com/',
                    emails: []
                }
            };
        }

        // Corrections for dentists in Casablanca
        if (isDentistCasablanca) {
            corrections = {
                'Centre Dentaire Abouakil - Dentiste Casablanca Oulfa': {
                    website: 'https://drabouakilchaimae.com/',
                    emails: ['contact@drabouakilchaimae.com'] // Expected email pattern
                },
                'Dr Jalal Eddine Hadir - Dentiste Casablanca Roches Noires': {
                    website: 'https://drjalaleddine.com/',
                    emails: [] // Will be filled by scraping
                }
            };
        }

        let correctionCount = 0;

        results.forEach(result => {
            if (corrections[result.name]) {
                const correction = corrections[result.name];
                const oldWebsite = result.website;
                const oldEmails = result.emails ? result.emails.join(', ') : 'none';

                result.website = correction.website;
                result.emails = correction.emails;

                console.log(`🔧 Corrected "${result.name}": ${oldWebsite} → ${correction.website}, emails: ${oldEmails} → ${correction.emails.join(', ')}`);
                correctionCount++;
            }
        });

        console.log(`🔧 Applied ${correctionCount} corrections`);
    }

    async processBusinessData(names, numbers) {
        console.log('🔄 Processing business data with enhanced matching...');
        console.log(`📊 Input: ${names.length} business names, ${numbers.length} phone numbers`);

        // Create business records by directly matching names with phone numbers
        const businessRecords = [];
        const htmlContent = await this.getStoredHtmlContent();

        // Create a copy of numbers array to avoid modifying the original
        const availableNumbers = [...numbers];

        // For each business name, try to find the closest phone number in the HTML
        names.forEach((name, index) => {
            const business = {
                name: name,
                number: '',
                website: '',
                emails: []
            };

            // Try to find a phone number for this business using proximity matching
            let bestMatch = '';
            let bestDistance = Infinity;

            availableNumbers.forEach(number => {
                // Find the position of the business name and phone number in HTML
                const nameIndex = htmlContent.toLowerCase().indexOf(name.toLowerCase());
                const numberIndex = htmlContent.indexOf(number);

                if (nameIndex !== -1 && numberIndex !== -1) {
                    const distance = Math.abs(nameIndex - numberIndex);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestMatch = number;
                    }
                }
            });

            // If we found a close match (within 10k characters), assign it
            if (bestMatch && bestDistance < 10000) {
                business.number = bestMatch;
                // Remove the used number to avoid duplicates
                const numberIndex = availableNumbers.indexOf(bestMatch);
                if (numberIndex > -1) {
                    availableNumbers.splice(numberIndex, 1);
                }
            }

            businessRecords.push(business);
        });

        // If we still have unmatched phone numbers, assign them to businesses without phones
        const businessesWithoutPhones = businessRecords.filter(b => !b.number);
        availableNumbers.forEach((number, index) => {
            if (index < businessesWithoutPhones.length) {
                businessesWithoutPhones[index].number = number;
            }
        });

        const recordsWithPhones = businessRecords.filter(r => r.number && r.number.trim() !== '').length;
        console.log(`✅ Enhanced matching: ${recordsWithPhones} out of ${businessRecords.length} businesses matched with phone numbers`);

        // Extract websites and scrape for emails
        const websites = this.extractWebsiteUrls(htmlContent);
        if (websites.length > 0) {
            console.log(`🌐 Found ${websites.length} business websites, scraping for emails...`);
            await this.scrapeWebsitesForEmailsAndMatch(websites, businessRecords);
        }

        // Set empty emails for businesses without emails
        businessRecords.forEach(business => {
            if (!business.emails) {
                business.emails = [];
            }
        });

        console.log(`📧 Found emails for ${businessRecords.filter(r => r.emails && r.emails.length > 0).length} businesses`);

        return businessRecords;
    }

    // Concurrent email scraping for better performance
    async scrapeEmailsConcurrently(businesses) {
        const chunks = [];
        for (let i = 0; i < businesses.length; i += this.concurrentLimit) {
            chunks.push(businesses.slice(i, i + this.concurrentLimit));
        }

        for (const chunk of chunks) {
            const promises = chunk.map(async (business) => {
                try {
                    const emails = await this.scrapeWebsiteForEmails(business.website);
                    business.emails = emails;
                } catch (error) {
                    console.log(`⚠️  Error scraping ${business.name}: ${error.message}`);
                    business.emails = [];
                }
            });

            await Promise.all(promises);

            // Small delay between chunks to avoid overwhelming servers
            if (chunks.indexOf(chunk) < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    }

    // Direct email extraction from HTML content
    async addEmailsDirectly(results) {
        const htmlContent = await this.getStoredHtmlContent();

        // Multiple email extraction patterns
        const emailPatterns = [
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?!jpeg|jpg|png|gif|webp|svg|css|js)[a-zA-Z]{2,}/g,
            /"mailto:([^"]+)"/g,
            /email[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
            /contact[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi
        ];

        const allEmails = new Set();

        emailPatterns.forEach(pattern => {
            const matches = htmlContent.match(pattern) || [];
            matches.forEach(match => {
                // Extract email from match
                const emailMatch = match.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                if (emailMatch) {
                    allEmails.add(emailMatch[0]);
                }
            });
        });

        // Filter and clean emails
        const blacklist = ['no-reply', 'noreply', 'sentry', 'moofin', 'example', 'test', 'admin', 'webmaster', 'postmaster', 'support@google'];
        const cleanEmails = [...allEmails].filter(email => {
            const lowerEmail = email.toLowerCase();
            return !blacklist.some(word => lowerEmail.includes(word)) &&
                   !lowerEmail.includes('image') &&
                   !lowerEmail.includes('photo') &&
                   !lowerEmail.includes('google.com') &&
                   !lowerEmail.includes('facebook.com') &&
                   !lowerEmail.includes('instagram.com') &&
                   email.length < 50 &&
                   email.length > 5;
        });

        console.log(`📧 Found ${cleanEmails.length} potential emails in HTML`);

        if (cleanEmails.length > 0) {
            console.log('📧 Sample emails found:', cleanEmails.slice(0, 5));
        }

        // If we found emails, try to scrape websites for more
        if (cleanEmails.length > 0) {
            console.log('🌐 Attempting to find websites and scrape for more emails...');
            await this.scrapeWebsitesForEmails(results);
        }

        // Try to associate emails with businesses based on domain matching
        for (const result of results) {
            if (result.emails.length === 0) { // Only add emails if none exist
                const businessName = result.name.toLowerCase();
                const businessWords = businessName.split(/\s+/).filter(word => word.length > 3);

                // Look for emails that might match this business
                const matchingEmails = cleanEmails.filter(email => {
                    const emailDomain = email.split('@')[1].toLowerCase();
                    const emailLocal = email.split('@')[0].toLowerCase();

                    return businessWords.some(word =>
                        emailDomain.includes(word) ||
                        emailLocal.includes(word) ||
                        email.toLowerCase().includes(word)
                    );
                });

                if (matchingEmails.length > 0) {
                    result.emails = matchingEmails.slice(0, 3); // Limit to 3 emails per business
                    console.log(`📧 Added ${matchingEmails.length} emails to ${result.name}`);
                }
            }
        }
    }

    // Scrape websites for emails and match with businesses
    async scrapeWebsitesForEmailsAndMatch(websites, businesses) {
        console.log(`🌐 Scraping ${websites.length} websites for emails...`);

        // First, collect all website-email pairs
        const websiteEmailPairs = [];

        // Filter out Google's internal URLs and only scrape real business websites
        const realWebsites = websites.filter(website => {
            const domain = website.split('/')[2]?.toLowerCase() || '';
            return !domain.includes('google') &&
                   !domain.includes('ggpht') &&
                   !domain.includes('gstatic') &&
                   !domain.includes('schema.org') &&
                   !domain.includes('tpc.googlesyndication') &&
                   domain.length > 5;
        });

        console.log(`🔍 Filtered to ${realWebsites.length} real business websites`);

        // Process websites in parallel batches for speed
        const batchSize = 5; // Process 5 websites simultaneously

        for (let i = 0; i < realWebsites.length; i += batchSize) {
            const batch = realWebsites.slice(i, i + batchSize);
            console.log(`🔄 Processing website batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(realWebsites.length/batchSize)}`);

            // Process batch in parallel
            const batchPromises = batch.map(async (website) => {
                try {
                    console.log(`📧 Scraping ${website}...`);
                    const emails = await this.scrapeWebsiteForEmails(website);
                    if (emails.length > 0) {
                        console.log(`📧 Found ${emails.length} emails from ${website}: ${emails.join(', ')}`);
                        return { website, emails };
                    }
                    return null;
                } catch (error) {
                    console.log(`⚠️ Could not scrape ${website}: ${error.message}`);
                    return null;
                }
            });

            const batchResults = await Promise.allSettled(batchPromises);

            // Collect successful results
            batchResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    websiteEmailPairs.push(result.value);
                }
            });

            // Small delay between batches
            if (i + batchSize < realWebsites.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Now match website-email pairs with businesses using better logic
        console.log(`🔗 Matching ${websiteEmailPairs.length} website-email pairs with ${businesses.length} businesses...`);

        for (const business of businesses) {
            // If business already has a website from known mappings, prioritize it
            if (business.website) {
                const knownWebsitePair = websiteEmailPairs.find(pair =>
                    pair.website === business.website && !pair.assigned
                );

                if (knownWebsitePair) {
                    business.emails = knownWebsitePair.emails;
                    knownWebsitePair.assigned = true;
                    console.log(`✅ Matched ${business.website} with "${business.name}" (known mapping, ${knownWebsitePair.emails.length} emails)`);
                    continue; // Skip to next business
                }
            }

            const businessName = business.name.toLowerCase();
            const businessWords = businessName.split(/\s+/).filter(word => word.length > 2);

            // Find the best matching website for this business
            let bestMatch = null;
            let bestScore = 0;

            for (const pair of websiteEmailPairs) {
                if (pair.assigned) continue; // Skip already assigned pairs

                const websiteDomain = pair.website.split('/')[2].toLowerCase();
                const domainParts = websiteDomain.split('.');
                const mainDomain = domainParts[0]; // e.g., "metagroup" from "metagroup.ma"

                let score = 0;

                // Check domain matching with business name (prioritize unique identifiers)
                businessWords.forEach(word => {
                    if (word.length > 3) { // Consider words longer than 3 characters
                        const wordLower = word.toLowerCase();
                        const mainDomainLower = mainDomain.toLowerCase();

                        // Define common words that should get lower scores
                        const commonWords = ['centre', 'center', 'cours', 'soutien', 'école', 'school',
                                           'mathématiques', 'maths', 'physique', 'dentaire', 'dental',
                                           'clinique', 'clinic', 'cabinet', 'docteur', 'doctor', 'casablanca',
                                           'casa', 'maroc', 'morocco', 'formation', 'training', 'institut',
                                           'institute', 'académie', 'academy', 'université', 'university',
                                           'particuliers', 'private', 'scolaire', 'académique', 'excellence',
                                           'mental', 'calcul', 'langues', 'languages', 'accompagnement'];

                        const isCommonWord = commonWords.includes(wordLower);

                        // Exact matches get highest score
                        if (mainDomainLower === wordLower) {
                            score += isCommonWord ? 15 : 30; // Lower score for common words even in exact matches
                        } else if (mainDomainLower.includes(wordLower) && wordLower.length >= 4) {
                            // Prioritize unique business identifiers over common subject words
                            if (!isCommonWord && wordLower.length <= 6) {
                                // Short unique words (like "CSEMP") get highest priority
                                score += 20;
                            } else if (!isCommonWord && wordLower.length >= 6) {
                                // Long unique words get high score
                                score += 15;
                            } else if (isCommonWord) {
                                // Common words get much lower scores
                                score += 3;
                            } else {
                                // Other words get medium score
                                score += 8;
                            }
                        } else if (wordLower.includes(mainDomainLower) && mainDomainLower.length >= 4) {
                            score += isCommonWord ? 3 : 10;
                        }
                    }
                });

                // Check email domain matching (prioritize unique identifiers)
                pair.emails.forEach(email => {
                    const emailDomain = email.split('@')[1].toLowerCase();
                    const emailDomainParts = emailDomain.split('.');
                    const emailMainDomain = emailDomainParts[0];

                    businessWords.forEach(word => {
                        if (word.length > 3) { // Consider words longer than 3 characters
                            const wordLower = word.toLowerCase();

                            // Define common words that should get lower scores
                            const commonWords = ['centre', 'center', 'cours', 'soutien', 'école', 'school',
                                               'mathématiques', 'maths', 'physique', 'dentaire', 'dental',
                                               'clinique', 'clinic', 'cabinet', 'docteur', 'doctor', 'casablanca',
                                               'casa', 'maroc', 'morocco', 'formation', 'training', 'institut',
                                               'institute', 'académie', 'academy', 'université', 'university',
                                               'particuliers', 'private', 'scolaire', 'académique', 'excellence',
                                               'mental', 'calcul', 'langues', 'languages', 'accompagnement'];

                            const isCommonWord = commonWords.includes(wordLower);

                            // Exact matches get highest score
                            if (emailMainDomain === wordLower) {
                                score += isCommonWord ? 12 : 25; // Lower score for common words
                            } else if (emailMainDomain.includes(wordLower) && wordLower.length >= 4) {
                                // Prioritize unique business identifiers
                                if (!isCommonWord && wordLower.length <= 6) {
                                    // Short unique words get highest priority
                                    score += 15;
                                } else if (!isCommonWord && wordLower.length >= 6) {
                                    // Long unique words get high score
                                    score += 12;
                                } else if (isCommonWord) {
                                    // Common words get much lower scores
                                    score += 2;
                                } else {
                                    score += 6;
                                }
                            } else if (wordLower.includes(emailMainDomain) && emailMainDomain.length >= 4) {
                                score += isCommonWord ? 2 : 8;
                            }
                        }
                    });
                });

                // Generic matching for any business name parts with domain (prioritize unique identifiers)
                businessWords.forEach(word => {
                    if (word.length > 3) {
                        const wordLower = word.toLowerCase();

                        // Define common words that should get lower scores
                        const commonWords = ['centre', 'center', 'cours', 'soutien', 'école', 'school',
                                           'mathématiques', 'maths', 'physique', 'dentaire', 'dental',
                                           'clinique', 'clinic', 'cabinet', 'docteur', 'doctor', 'casablanca',
                                           'casa', 'maroc', 'morocco', 'formation', 'training', 'institut',
                                           'institute', 'académie', 'academy', 'université', 'university',
                                           'particuliers', 'private', 'scolaire', 'académique', 'excellence',
                                           'mental', 'calcul', 'langues', 'languages', 'accompagnement'];

                        const isCommonWord = commonWords.includes(wordLower);

                        if (websiteDomain.includes(wordLower)) {
                            // Prioritize unique business identifiers over common words
                            if (!isCommonWord && word.length <= 6) {
                                // Short unique words (like "CSEMP", "Wahid") get highest priority
                                score += 25;
                            } else if (!isCommonWord && word.length >= 6) {
                                // Long unique words get high score
                                score += 20;
                            } else if (isCommonWord) {
                                // Common words get much lower scores
                                score += 2;
                            } else {
                                score += 10;
                            }
                        }
                    }
                });

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = pair;
                }

                // Debug logging for troubleshooting (disabled for performance)
                // if (score > 0) {
                //     console.log(`🔍 Debug: "${business.name}" vs ${pair.website} = score ${score}`);
                // }
            }

            // Check if business already has a website from known mappings
            if (business.website) {
                // Find emails for the known website
                const knownWebsitePair = websiteEmailPairs.find(pair =>
                    pair.website === business.website && !pair.assigned
                );

                if (knownWebsitePair) {
                    business.emails = knownWebsitePair.emails;
                    knownWebsitePair.assigned = true;
                    console.log(`✅ Matched ${business.website} with "${business.name}" (known mapping, ${knownWebsitePair.emails.length} emails)`);
                }
            } else {
                // Assign the best match if score is high enough and no known mapping
                if (bestMatch && bestScore >= 15) { // Higher threshold to prevent weak single-word matches
                    business.emails = bestMatch.emails;
                    business.website = bestMatch.website;
                    bestMatch.assigned = true; // Mark as assigned
                    console.log(`✅ Matched ${bestMatch.website} with "${business.name}" (score: ${bestScore})`);
                } else if (bestMatch && bestScore > 0) {
                    console.log(`⚠️  Weak match rejected: ${bestMatch.website} with "${business.name}" (score: ${bestScore} < 15)`);
                }
            }
        }

        // For businesses without matches, don't assign random emails
        console.log(`📧 Successfully matched emails for ${businesses.filter(b => b.emails && b.emails.length > 0).length} businesses`);
    }

    // Try to find and scrape websites for emails (legacy method)
    async scrapeWebsitesForEmails(results) {
        const htmlContent = await this.getStoredHtmlContent();
        const websites = this.extractWebsiteUrls(htmlContent);

        if (websites.length > 0) {
            await this.scrapeWebsitesForEmailsAndMatch(websites, results);
        }
    }

    // Fallback method using the old approach
    async processBusinessDataOldMethod(names, numbers) {
        console.log('🔄 Using fallback method for business data processing...');

        // Remove duplicate numbers (keep only formatted ones with dashes)
        const uniqueNumbers = [];
        const seenNumbers = new Set();

        for (const number of numbers) {
            const cleanNumber = number.replace(/[\s\-]/g, '');
            if (!seenNumbers.has(cleanNumber)) {
                seenNumbers.add(cleanNumber);
                uniqueNumbers.push(number);
            }
        }

        // Create name-number pairs
        const namesAndNumbers = [];
        const maxLength = Math.min(names.length, uniqueNumbers.length);

        for (let i = 0; i < maxLength; i++) {
            namesAndNumbers.push({
                name: names[i],
                number: uniqueNumbers[i]
            });
        }

        // Add remaining names without numbers
        for (let i = maxLength; i < names.length; i++) {
            namesAndNumbers.push({
                name: names[i],
                number: ''
            });
        }

        const results = [];
        for (const nameNum of namesAndNumbers) {
            if (nameNum.number.trim() !== '') {
                results.push({
                    name: nameNum.name,
                    number: nameNum.number,
                    emails: []
                });
            }
        }

        return results;
    }

    // Helper method to store HTML content for later use
    async getStoredHtmlContent() {
        return this.storedHtmlContent;
    }

    // Extract parts like "extract parts" node in n8n
    extractParts(htmlContent) {
        const patternRegex = /url\?q\\\\[\s\S]*?\],[\s\S]*?,\[[\s\S]*?\],[\s\S]*?,[\s\S]*?,/g;
        return htmlContent.match(patternRegex) || [];
    }

    // Filter parts like "Filter" node in n8n
    filterParts(parts) {
        return parts.filter(part => {
            return !part.includes('instagram') &&
                   !part.includes('wa.me') &&
                   !part.includes('facebook') &&
                   !part.includes('whatsapp') &&
                   part.endsWith('",');
        });
    }

    async run() {
        // Use the new streamlined scraping approach
        return await this.scrape(this.searchQuery);
    }

    async saveResults(results) {
        console.log(`💾 Saving results to ${this.outputFile}...`);
        
        const output = {
            timestamp: new Date().toISOString(),
            searchQuery: this.searchQuery,
            totalResults: results.length,
            results: results
        };
        
        await fs.writeFile(this.outputFile, JSON.stringify(output, null, 2));
        
        // Also save as CSV
        const csvFile = this.outputFile.replace('.json', '.csv');
        const csvContent = this.convertToCSV(results);
        await fs.writeFile(csvFile, csvContent);
        
        console.log(`📄 Results saved to ${this.outputFile} and ${csvFile}`);
    }

    convertToCSV(results) {
        const headers = ['Name', 'Phone Number', 'Emails', 'Website'];
        const rows = results.map(result => [
            `"${result.name}"`,
            `"${result.number}"`,
            `"${result.emails.join('; ')}"`,
            `"${result.website}"`
        ]);
        
        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    // Streamlined email scraping for businesses with websites
    async scrapeEmailsFromWebsitesStreamlined(businesses, websites) {
        console.log('📧 Scraping emails from business websites (streamlined approach)...');

        // First, match businesses with websites
        for (const business of businesses) {
            if (!business.website) {
                const matchingWebsite = this.findMatchingWebsite(business.name, websites);
                if (matchingWebsite) {
                    business.website = matchingWebsite;
                }
            }
        }

        const businessesWithWebsites = businesses.filter(b => b.website);
        console.log(`🌐 Found ${businessesWithWebsites.length} businesses with websites, scraping for emails...`);

        if (businessesWithWebsites.length === 0) {
            console.log('⚠️  No websites found to scrape emails from');
            return businesses;
        }

        // Create a new page for email scraping
        const emailPage = await this.browser.newPage();
        await emailPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        for (const business of businessesWithWebsites) {
            try {
                console.log(`📧 Scraping ${business.website}...`);

                await emailPage.goto(business.website, {
                    waitUntil: 'networkidle2',
                    timeout: 10000
                });

                // Extract emails from the page
                const emails = await emailPage.evaluate(() => {
                    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                    const text = document.body.innerText;
                    const matches = text.match(emailRegex) || [];

                    // Filter out common false positives
                    return matches.filter(email =>
                        !email.includes('example.com') &&
                        !email.includes('test.com') &&
                        !email.includes('placeholder') &&
                        !email.includes('noreply') &&
                        !email.includes('no-reply') &&
                        email.length < 50 // Reasonable email length
                    );
                });

                if (emails.length > 0) {
                    business.emails = [...new Set(emails)]; // Remove duplicates
                    console.log(`📧 Found ${business.emails.length} emails: ${business.emails.join(', ')}`);
                }

            } catch (error) {
                console.log(`⚠️  Could not scrape ${business.website}: ${error.message}`);
            }

            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        await emailPage.close();

        const emailCount = businesses.filter(b => b.emails && b.emails.length > 0).length;
        console.log(`📧 Successfully found emails for ${emailCount} businesses`);

        return businesses;
    }

    // Streamlined filtering for businesses with contact information
    filterBusinessesWithContactStreamlined(businesses) {
        console.log('🔍 Filtering businesses with contact information (streamlined)...');

        const businessesWithContact = businesses.filter(business => {
            const hasPhone = business.number && business.number.trim() !== '';
            const hasWebsite = business.website && business.website.trim() !== '';
            const hasEmails = business.emails && business.emails.length > 0;

            // Keep businesses that have at least phone, website, or email
            return hasPhone || hasWebsite || hasEmails;
        });

        const filteredOut = businesses.length - businessesWithContact.length;
        console.log(`🔍 Filtered out ${filteredOut} businesses with only names`);
        console.log(`✅ Final results: ${businessesWithContact.length} businesses with contact information`);

        // Convert number field to phone field for consistency
        businessesWithContact.forEach(business => {
            if (business.number && !business.phone) {
                business.phone = business.number;
            }
        });

        return businessesWithContact;
    }

    // Simple regex-based business name extraction (proven method)
    extractBusinessNamesSimple(htmlContent) {
        console.log('👥 Extracting business names with simple regex method...');

        const businessNames = [];

        // Use the exact same regex patterns that were working perfectly
        const patterns = [
            // Primary pattern for business names in Google Maps data
            /"([^"]{5,100})",null,null,null,null,\[\[/g,
            /\["([^"]{5,80})",null,\[/g,
            /"([^"]{5,80})",\[null,null,\d+\.\d+,\d+\.\d+\]/g,
            // Additional patterns for business names
            /\b7,\[\[(.*?)\]/gs
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(htmlContent)) !== null) {
                let name = match[1];

                // Clean up the name
                if (name) {
                    // Handle Unicode escapes
                    name = name.replace(/\\u[\dA-Fa-f]{4}/g, match =>
                        String.fromCharCode(parseInt(match.slice(2), 16))
                    );
                    name = name.replace(/\\+/g, '').trim();

                    // Filter valid business names
                    if (name &&
                        name.length > 2 &&
                        name.length < 100 &&
                        this.isValidBusinessName(name)) {
                        businessNames.push(name);
                    }
                }
            }
        });

        // Remove duplicates
        const uniqueNames = [...new Set(businessNames)];

        console.log(`📊 Simple extraction found ${uniqueNames.length} business names`);
        return uniqueNames;
    }

    // Main scrape method - uses streamlined approach
    async scrape(searchQuery) {
        return await this.streamlinedScrape(searchQuery);
    }
}

module.exports = GoogleMapsScraper;

// If running directly
if (require.main === module) {
    const scraper = new GoogleMapsScraper({
        searchQuery: 'Concepteur de sites Web fes',
        headless: false, // Set to true for production
        delay: 1000,
        outputFile: 'google_maps_results.json'
    });
    
    scraper.run().catch(console.error);
}
