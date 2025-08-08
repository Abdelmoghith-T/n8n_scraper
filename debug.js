const GoogleMapsScraper = require('./scraper');

// n8n results for comparison
const n8nResults = [
  { "name": "Webmarko", "number": "0661-511183", "emails": [] },
  { "name": "Metagroup création site web fés", "number": "0708-023048", "emails": [] },
  { "name": "NassimSEO Création Site Web", "number": "0669-947515", "emails": ["contact@nassimseo.com"] },
  { "name": "Fesweb", "number": "05356-51358", "emails": [] },
  { "name": "Appbox", "number": "0690-402020", "emails": [] },
  { "name": "Création site web Maroc fés", "number": "0608-023048", "emails": ["contact@inventis.ma"] },
  { "name": "Inventis", "number": "05356-21314", "emails": [] },
  { "name": "isweb", "number": "0532-042566", "emails": [] },
  { "name": "Webeasy", "number": "0663-446461", "emails": ["contact@rythmedia.com"] },
  { "name": "Rythme Media Fes - Création site web Fes - Agence web Fes", "number": "0605-462993", "emails": ["info@example.com"] },
  { "name": "Marweb", "number": "0646-166236", "emails": ["abi6soft@gmail.com"] },
  { "name": "Cabinet ABIsoft", "number": "0660-972646", "emails": [] },
  { "name": "MyDigi", "number": "0663-446461", "emails": [] },
  { "name": "YO Digital - Agence Marketing Digital", "number": "0661-659353", "emails": [] },
  { "name": "Creative Web", "number": "0687-919443", "emails": [] },
  { "name": "FUTUR DEVELOPPEMENT", "number": "05359-31973", "emails": [] },
  { "name": "Kreazin MEDIA", "number": "05356-24041", "emails": [] },
  { "name": "Screenday", "number": "0532-001024", "emails": [] },
  { "name": "MAROCRANK", "number": "0664-817088", "emails": ["contact@marocrank.com", "support@marocrank.com"] }
];

async function debugScraper() {
    console.log('🔍 Debug Mode - Comparing n8n vs Node.js results');
    console.log('=================================================');
    
    const scraper = new GoogleMapsScraper({
        searchQuery: 'Concepteur de sites Web fes',
        headless: true,
        delay: 1000,
        outputFile: 'debug_results.json'
    });
    
    try {
        // Just extract data without processing
        await scraper.init();
        const htmlContent = await scraper.scrapeGoogleMaps();
        
        const names = scraper.extractBusinessNames(htmlContent);
        const numbers = scraper.extractPhoneNumbers(htmlContent);
        const websites = scraper.extractWebsiteUrls(htmlContent);
        
        console.log('\n📊 Raw Extraction Results:');
        console.log(`Names: ${names.length}`);
        console.log(`Numbers: ${numbers.length}`);
        console.log(`Websites: ${websites.length}`);
        
        console.log('\n👥 All Names:');
        names.forEach((name, i) => console.log(`${i+1}. ${name}`));
        
        console.log('\n📞 All Numbers:');
        numbers.forEach((number, i) => console.log(`${i+1}. ${number}`));
        
        console.log('\n🔍 n8n Results (for comparison):');
        n8nResults.forEach((result, i) => {
            console.log(`${i+1}. ${result.name} → ${result.number}`);
        });
        
        // Check which names from n8n are in our extracted names
        console.log('\n✅ Names found in both:');
        const foundNames = [];
        n8nResults.forEach(n8nResult => {
            const found = names.find(name => name === n8nResult.name);
            if (found) {
                foundNames.push(found);
                console.log(`✓ ${found}`);
            } else {
                console.log(`✗ Missing: ${n8nResult.name}`);
            }
        });
        
        console.log(`\n📈 Match rate: ${foundNames.length}/${n8nResults.length} (${Math.round(foundNames.length/n8nResults.length*100)}%)`);
        
    } catch (error) {
        console.error('❌ Debug failed:', error);
    } finally {
        if (scraper.browser) {
            await scraper.browser.close();
        }
    }
}

debugScraper().catch(console.error);
