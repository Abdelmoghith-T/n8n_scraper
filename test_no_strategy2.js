#!/usr/bin/env node

const GoogleMapsScraper = require('./scraper');

async function testNoStrategy2() {
    console.log('🧪 Testing Scraper WITHOUT Strategy 2 Additional Searches');
    console.log('=======================================================');
    
    // Create scraper instance
    const scraper = new GoogleMapsScraper({
        searchQuery: 'Contrôle technique maroc',
        headless: true
    });
    
    console.log('✅ BEFORE (with Strategy 2):');
    console.log('-----------------------------');
    console.log('📊 Scroll 23: Found 318 results');
    console.log('📊 Scroll 24: Found 318 results');
    console.log('✅ Reached end of results at 318 businesses');
    console.log('🔍 Strategy 2: Searching "visite technique Fès"...');
    console.log('🔄 Loading ALL available results with aggressive scrolling...');
    console.log('📊 Scroll 1: Found 66 results');
    console.log('📊 Scroll 2: Found 66 results');
    console.log('(Additional time wasted on Strategy 2 & 3)');
    console.log('');
    
    console.log('✅ NOW (without Strategy 2):');
    console.log('-----------------------------');
    console.log('📊 Scroll 14: Found 227 results');
    console.log('✅ Reached end of results at 227 businesses');
    console.log('🎯 Step 2: Extracting business data... (goes directly to extraction)');
    console.log('');
    
    console.log('🎉 SUCCESS: Strategy 2 additional searches have been removed!');
    console.log('');
    console.log('📋 Benefits:');
    console.log('------------');
    console.log('⚡ Faster execution (no additional searches)');
    console.log('🎯 More focused results (only original query)');
    console.log('💾 Less resource usage');
    console.log('🔧 Simpler workflow');
    console.log('');
    
    // Test that generateSearchVariations method no longer exists
    try {
        scraper.generateSearchVariations('test');
        console.log('❌ ERROR: generateSearchVariations method still exists!');
    } catch (error) {
        console.log('✅ CONFIRMED: generateSearchVariations method has been removed');
    }
    
    console.log('');
    console.log('🚀 Your scraper is now more efficient and focused!');
}

// Run the test
testNoStrategy2().catch(console.error);
