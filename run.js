#!/usr/bin/env node

const GoogleMapsScraper = require('./scraper');

async function main() {
    console.log('🔍 Google Maps Business Scraper');
    console.log('================================');
    
    // Configuration options
    const config = {
        searchQuery: process.argv[2] || 'Concepteur de sites Web fes',
        headless: process.env.HEADLESS !== 'false', // Set HEADLESS=false to see browser
        delay: parseInt(process.env.DELAY) || 1000,
        outputFile: process.env.OUTPUT_FILE || 'google_maps_results.json'
    };
    
    console.log(`🎯 Search Query: ${config.searchQuery}`);
    console.log(`🤖 Headless Mode: ${config.headless}`);
    console.log(`⏱️  Delay: ${config.delay}ms`);
    console.log(`📁 Output File: ${config.outputFile}`);
    console.log('');
    
    const scraper = new GoogleMapsScraper(config);
    
    try {
        const results = await scraper.run();
        
        console.log('\n📋 SUMMARY:');
        console.log('===========');
        console.log(`✅ Total businesses found: ${results.length}`);
        console.log(`📞 With phone numbers: ${results.filter(r => r.number.trim()).length}`);
        console.log(`📧 With emails: ${results.filter(r => r.emails.length > 0).length}`);
        console.log(`🌐 With websites: ${results.filter(r => r.website).length}`);
        console.log(`📍 With locations: ${results.filter(r => r.location && r.location.trim()).length}`);
        
        if (results.length > 0) {
            console.log('\n🎉 Sample results:');
            results.slice(0, 3).forEach((result, index) => {
                console.log(`\n${index + 1}. ${result.name}`);
                console.log(`   📞 ${result.number || 'No phone'}`);
                console.log(`   📧 ${result.emails.length > 0 ? result.emails.join(', ') : 'No emails'}`);
                console.log(`   🌐 ${result.website || 'No website'}`);
                console.log(`   📍 ${result.location || 'No location'}`);
            });
        }
        
    } catch (error) {
        console.error('\n❌ Error occurred:', error.message);
        process.exit(1);
    }
}

// Handle command line arguments and help
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
🔍 Google Maps Business Scraper
===============================

Usage: node run.js [search_query]

Examples:
  node run.js "restaurants in Paris"
  node run.js "dentists in New York"
  HEADLESS=false node run.js "web designers in Fes"

Environment Variables:
  HEADLESS=false    Show browser window (default: true)
  DELAY=2000        Delay between requests in ms (default: 1000)
  OUTPUT_FILE=my_results.json    Custom output filename

The scraper will:
1. Search Google Maps for the specified query
2. Extract business names, phone numbers, and websites
3. Visit each website to find email addresses
4. Save results to JSON and CSV files

Results are saved to 'google_maps_results.json' and 'google_maps_results.csv'
`);
    process.exit(0);
}

main().catch(console.error);
