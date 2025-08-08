const GoogleMapsScraper = require('./scraper');
const fs = require('fs').promises;

async function debugEmailExtraction() {
    console.log('🔍 Debug: Email and Website Extraction');
    console.log('=====================================');
    
    const scraper = new GoogleMapsScraper({
        searchQuery: 'Concepteur de sites Web fes',
        headless: true,
        delay: 1000
    });
    
    try {
        await scraper.init();
        const htmlContent = await scraper.scrapeGoogleMaps();
        
        // Save HTML for manual inspection
        await fs.writeFile('debug_google_maps.html', htmlContent);
        console.log('📄 Saved HTML to debug_google_maps.html');
        
        console.log('\n🔍 Searching for emails in HTML...');
        
        // Try different email patterns
        const emailPatterns = [
            /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            /"mailto:([^"]+)"/g,
            /email[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
            /contact[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
            /@[a-zA-Z0-9.-]+\.ma/g,
            /@[a-zA-Z0-9.-]+\.com/g
        ];
        
        emailPatterns.forEach((pattern, index) => {
            const matches = htmlContent.match(pattern) || [];
            console.log(`Pattern ${index + 1}: Found ${matches.length} matches`);
            if (matches.length > 0) {
                console.log(`  Sample: ${matches.slice(0, 3).join(', ')}`);
            }
        });
        
        console.log('\n🌐 Searching for websites in HTML...');
        
        // Try different website patterns
        const websitePatterns = [
            /https?:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}[^\s\]",]*/g,
            /"(https?:\/\/[^"]+\.ma[^"]*)"/g,
            /"(https?:\/\/[^"]+\.com[^"]*)"/g,
            /url\?q=(https?:\/\/[^&\s]+)/g
        ];
        
        websitePatterns.forEach((pattern, index) => {
            const matches = htmlContent.match(pattern) || [];
            console.log(`Website Pattern ${index + 1}: Found ${matches.length} matches`);
            if (matches.length > 0) {
                const cleanMatches = matches.map(match => {
                    if (match.includes('url?q=')) {
                        return match.replace('url?q=', '');
                    }
                    return match.replace(/["']/g, '');
                }).filter(url => 
                    !url.includes('google.') &&
                    !url.includes('ggpht.') &&
                    !url.includes('schema.org') &&
                    !url.includes('facebook') &&
                    !url.includes('instagram')
                );
                console.log(`  Clean matches: ${cleanMatches.slice(0, 5).join(', ')}`);
            }
        });
        
        console.log('\n🔍 Looking for business-specific data...');
        
        // Look for specific business names and their context
        const businessNames = [
            'NassimSEO',
            'Metagroup',
            'Webmarko',
            'Appbox',
            'Webeasy'
        ];
        
        businessNames.forEach(name => {
            const regex = new RegExp(`.{0,200}${name}.{0,200}`, 'gi');
            const matches = htmlContent.match(regex) || [];
            if (matches.length > 0) {
                console.log(`\n📍 Context for ${name}:`);
                matches.slice(0, 2).forEach((match, i) => {
                    console.log(`  ${i + 1}. ${match.substring(0, 150)}...`);
                });
            }
        });
        
        console.log('\n🔍 Searching for contact information patterns...');
        
        // Look for contact patterns
        const contactPatterns = [
            /contact[^@]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
            /info[^@]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
            /hello[^@]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
            /support[^@]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi
        ];
        
        contactPatterns.forEach((pattern, index) => {
            const matches = htmlContent.match(pattern) || [];
            console.log(`Contact Pattern ${index + 1}: Found ${matches.length} matches`);
            if (matches.length > 0) {
                console.log(`  Matches: ${matches.slice(0, 3).join(', ')}`);
            }
        });
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        if (scraper.browser) {
            await scraper.browser.close();
        }
    }
}

debugEmailExtraction().catch(console.error);
