const GoogleMapsScraper = require('./scraper');
const fs = require('fs').promises;

async function analyzeGoogleMapsStructure() {
    console.log('🔍 Analyzing Google Maps HTML Structure');
    console.log('=====================================');
    
    const scraper = new GoogleMapsScraper({
        searchQuery: 'Concepteur de sites Web fes',
        headless: true,
        delay: 1000
    });
    
    try {
        await scraper.init();
        const htmlContent = await scraper.scrapeGoogleMaps();
        
        // Save HTML for analysis
        await fs.writeFile('google_maps_raw.html', htmlContent);
        console.log('📄 Saved raw HTML to google_maps_raw.html');
        
        // Look for patterns that contain business data
        console.log('\n🔍 Analyzing data patterns...');
        
        // Pattern 1: Look for business name patterns
        const namePattern = /7,\[\[([^\]]+)\]/g;
        let nameMatches = [];
        let match;
        while ((match = namePattern.exec(htmlContent)) !== null) {
            nameMatches.push(match[1]);
        }
        console.log(`📝 Found ${nameMatches.length} name pattern matches`);
        
        // Pattern 2: Look for phone number contexts
        const phonePattern = /(?:\+212|0)[\s\-]?(5|6|7)(?:[\s\-]?\d){8}/g;
        const phoneMatches = htmlContent.match(phonePattern) || [];
        console.log(`📞 Found ${phoneMatches.length} phone numbers`);
        
        // Pattern 3: Look for structured data blocks
        const structuredDataPattern = /\[\[null,null,\d+,\d+,\d+\],[^\]]+\]/g;
        const structuredMatches = htmlContent.match(structuredDataPattern) || [];
        console.log(`🏗️  Found ${structuredMatches.length} structured data blocks`);
        
        // Pattern 4: Look for business listing patterns
        const businessPattern = /\["[^"]+",\d+,\d+,\[\[null,null,\d+,\d+,\d+\]/g;
        const businessMatches = htmlContent.match(businessPattern) || [];
        console.log(`🏢 Found ${businessMatches.length} business listing patterns`);
        
        // Pattern 5: Look for the actual data structure used by n8n
        const n8nPattern = /url\?q\\\\[^,]+,[^,]+,\[[^\]]+\],[^,]+,[^,]+,/g;
        const n8nMatches = htmlContent.match(n8nPattern) || [];
        console.log(`🎯 Found ${n8nMatches.length} n8n-style patterns`);
        
        // Show first few matches of each pattern
        if (nameMatches.length > 0) {
            console.log('\n📝 First 3 name matches:');
            nameMatches.slice(0, 3).forEach((match, i) => {
                console.log(`${i+1}. ${match.substring(0, 100)}...`);
            });
        }
        
        if (phoneMatches.length > 0) {
            console.log('\n📞 First 10 phone matches:');
            phoneMatches.slice(0, 10).forEach((match, i) => {
                console.log(`${i+1}. ${match}`);
            });
        }
        
        if (n8nMatches.length > 0) {
            console.log('\n🎯 First 3 n8n-style matches:');
            n8nMatches.slice(0, 3).forEach((match, i) => {
                console.log(`${i+1}. ${match.substring(0, 200)}...`);
            });
        }
        
        // Try to find the correlation between names and phones
        console.log('\n🔗 Analyzing name-phone correlations...');
        
        // Look for patterns where names and phones appear together
        const combinedPattern = /([^,\[\]"]{10,50})[^0-9]{0,100}((?:\+212|0)[\s\-]?(5|6|7)(?:[\s\-]?\d){8})/g;
        const combinedMatches = [];
        let combinedMatch;
        while ((combinedMatch = combinedPattern.exec(htmlContent)) !== null) {
            combinedMatches.push({
                name: combinedMatch[1].trim(),
                phone: combinedMatch[2]
            });
        }
        
        console.log(`🔗 Found ${combinedMatches.length} potential name-phone correlations`);
        if (combinedMatches.length > 0) {
            console.log('\n🔗 First 5 correlations:');
            combinedMatches.slice(0, 5).forEach((match, i) => {
                console.log(`${i+1}. "${match.name}" → ${match.phone}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Analysis failed:', error);
    } finally {
        if (scraper.browser) {
            await scraper.browser.close();
        }
    }
}

analyzeGoogleMapsStructure().catch(console.error);
