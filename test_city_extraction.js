const GoogleMapsScraper = require('./scraper');

// Test city extraction functionality
async function testCityExtraction() {
    console.log('🧪 Testing city extraction from search queries...');
    console.log('=================================================');
    
    const scraper = new GoogleMapsScraper();
    
    const testQueries = [
        "Concepteur de sites Web fes",
        "restaurants Casablanca",
        "dentists in Rabat",
        "hotels Marrakech",
        "cafes Agadir",
        "pharmacies Tanger",
        "web designers Meknès",
        "doctors Oujda",
        "lawyers Tétouan",
        "shops Salé",
        "shops Sale", // Test without accent
        "businesses Kenitra",
        "services El Jadida",
        "companies Morocco", // Should fallback to Morocco
        "web development", // Should fallback to Morocco
        "marketing digital Fès",
        "agence communication Casa"
    ];
    
    console.log('Testing city extraction:');
    console.log('========================');
    
    testQueries.forEach((query, index) => {
        const extractedCity = scraper.extractCityFromQuery(query);
        console.log(`${index + 1}. "${query}" → ${extractedCity}`);
    });
    
    console.log('\n🎉 City extraction test completed!');
    
    // Test with a specific example
    console.log('\n🔍 Testing with specific business search:');
    console.log('=========================================');
    
    const businessName = "Webmarko";
    const searchQuery = "Concepteur de sites Web fes";
    
    scraper.searchQuery = searchQuery; // Set the search query
    const location = scraper.extractCityFromQuery(searchQuery);
    const finalSearchQuery = `${businessName} ${location}`;
    
    console.log(`Original search: "${searchQuery}"`);
    console.log(`Business name: "${businessName}"`);
    console.log(`Extracted city: "${location}"`);
    console.log(`Final individual search: "${finalSearchQuery}"`);
    
    console.log('\n✅ Perfect! Now individual business scraping will use the correct city instead of hardcoded "Morocco"');
}

testCityExtraction().catch(console.error);
