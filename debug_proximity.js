const GoogleMapsScraper = require('./scraper.js');

async function debugProximity() {
    const scraper = new GoogleMapsScraper({
        searchQuery: 'Concepteur de sites Web fes',
        headless: false,
        delay: 1000,
        outputFile: 'debug_proximity.json'
    });
    
    try {
        await scraper.init();
        const htmlContent = await scraper.scrapeGoogleMaps();
        
        // Get business names and phone numbers
        const names = await scraper.extractBusinessNames(htmlContent);
        const numbers = scraper.extractPhoneNumbers(htmlContent);
        
        console.log('\n🔍 Debugging proximity matching:');
        console.log(`Found ${names.length} names and ${numbers.length} numbers`);
        
        // Test proximity matching for specific businesses
        const testBusinesses = [
            'Webmarko',
            'Metagroup création site web fés', 
            'NassimSEO Création Site Web',
            'Appbox',
            'isweb'
        ];
        
        testBusinesses.forEach(businessName => {
            console.log(`\n🎯 Testing proximity for: "${businessName}"`);
            
            // Find business name in HTML
            const nameIndex = htmlContent.toLowerCase().indexOf(businessName.toLowerCase());
            console.log(`  Name found at position: ${nameIndex}`);
            
            if (nameIndex !== -1) {
                // Show context around the business name
                const contextStart = Math.max(0, nameIndex - 200);
                const contextEnd = Math.min(htmlContent.length, nameIndex + 200);
                const context = htmlContent.substring(contextStart, contextEnd);
                console.log(`  Context: ...${context.substring(0, 100)}...`);
                
                // Find closest phone numbers
                let bestMatches = [];
                numbers.forEach(number => {
                    const numberIndex = htmlContent.indexOf(number);
                    if (numberIndex !== -1) {
                        const distance = Math.abs(nameIndex - numberIndex);
                        bestMatches.push({ number, distance, position: numberIndex });
                    }
                });
                
                // Sort by distance
                bestMatches.sort((a, b) => a.distance - b.distance);
                
                console.log(`  Top 3 closest phone numbers:`);
                bestMatches.slice(0, 3).forEach((match, i) => {
                    console.log(`    ${i+1}. ${match.number} (distance: ${match.distance}, position: ${match.position})`);
                });
            } else {
                console.log(`  ❌ Business name not found in HTML`);
            }
        });
        
        await scraper.browser.close();
        
    } catch (error) {
        console.error('Error:', error);
        if (scraper.browser) {
            await scraper.browser.close();
        }
    }
}

debugProximity();
