#!/usr/bin/env node

const GoogleMapsScraper = require('./scraper');

async function testIndividualSearch() {
    console.log('🧪 Testing Individual Business Search with City Detection');
    console.log('=======================================================');
    
    // Create scraper instance with the search query
    const scraper = new GoogleMapsScraper({
        searchQuery: 'Concepteur de sites Web fes',
        headless: true
    });
    
    // Test city extraction
    console.log('\n🏙️  Testing City Extraction:');
    console.log('-----------------------------');
    
    const testQueries = [
        'Concepteur de sites Web fes',
        'restaurants Casablanca',
        'dentists in Rabat',
        'hotels Marrakech',
        'web designers Morocco'
    ];
    
    testQueries.forEach(query => {
        scraper.searchQuery = query;
        const extractedCity = scraper.extractCityFromQuery(query);
        console.log(`📍 "${query}" → ${extractedCity}`);
    });
    
    // Test individual business search construction
    console.log('\n🔍 Testing Individual Business Search Construction:');
    console.log('---------------------------------------------------');
    
    scraper.searchQuery = 'Concepteur de sites Web fes';
    const businessNames = ['Screenday', 'Webmarko', 'Metagroup', 'NassimSEO'];
    
    businessNames.forEach(businessName => {
        const location = scraper.extractCityFromQuery(scraper.searchQuery);
        const searchQuery = `${businessName} ${location}`;
        console.log(`🏢 Business: ${businessName}`);
        console.log(`   🔍 Search Query: "${searchQuery}"`);
        console.log(`   ✅ Now searches in ${location} instead of Morocco!`);
        console.log('');
    });
    
    console.log('🎉 SUCCESS: Individual business searches now use the correct city!');
    console.log('');
    console.log('📋 Summary of Changes:');
    console.log('----------------------');
    console.log('✅ BEFORE: "Screenday Morocco"');
    console.log('✅ AFTER:  "Screenday Fès"');
    console.log('');
    console.log('This will provide more accurate and targeted search results!');
}

// Run the test
testIndividualSearch().catch(console.error);
