const GoogleMapsScraper = require('./scraper.js');

async function debugNames() {
    const scraper = new GoogleMapsScraper({
        searchQuery: 'Concepteur de sites Web fes',
        headless: false,
        delay: 1000,
        outputFile: 'debug_names.json'
    });
    
    try {
        await scraper.init();
        const htmlContent = await scraper.scrapeGoogleMaps();
        
        console.log('\n🔍 Testing different extraction methods:');
        
        // Test 1: Simple regex method
        console.log('\n1️⃣ Simple regex extraction:');
        const simpleNames = scraper.extractBusinessNamesSimple(htmlContent);
        console.log(`Found ${simpleNames.length} names`);
        simpleNames.slice(0, 10).forEach((name, i) => console.log(`  ${i+1}. ${name}`));
        
        // Test 2: DOM-based extraction
        console.log('\n2️⃣ DOM-based extraction:');
        const domNames = await scraper.extractBusinessNamesFromDOM();
        console.log(`Found ${domNames.length} names`);
        domNames.slice(0, 10).forEach((name, i) => console.log(`  ${i+1}. ${name}`));
        
        // Test 3: URL-based extraction
        console.log('\n3️⃣ URL-based extraction:');
        const urlNames = await scraper.extractBusinessNamesFromURLs();
        console.log(`Found ${urlNames.length} names`);
        urlNames.slice(0, 10).forEach((name, i) => console.log(`  ${i+1}. ${name}`));
        
        // Test 4: Current extractBusinessNames method
        console.log('\n4️⃣ Current extractBusinessNames method:');
        const currentNames = await scraper.extractBusinessNames(htmlContent);
        console.log(`Found ${currentNames.length} names`);
        currentNames.slice(0, 10).forEach((name, i) => console.log(`  ${i+1}. ${name}`));
        
        await scraper.browser.close();
        
    } catch (error) {
        console.error('Error:', error);
        if (scraper.browser) {
            await scraper.browser.close();
        }
    }
}

debugNames();
