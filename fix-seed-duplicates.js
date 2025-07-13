const fs = require('fs');
const path = require('path');
const prisma = require('./src/config/database');

async function fixSeedAndCleanDuplicates() {
  try {
    console.log('🔧 Starting seed fix and duplicate cleanup...\n');
    
    // 1. First, let's see current state
    console.log('📊 Current database state:');
    const stats = {
      adminUsers: await prisma.adminUser.count(),
      staff: await prisma.gooseCorpStaff.count(),
      visitors: await prisma.gooseCorpUser.count(),
      formations: await prisma.gooseCorpFormation.count(),
      visits: await prisma.visit.count(),
      logs: await prisma.log.count()
    };
    
    Object.entries(stats).forEach(([key, count]) => {
      console.log(`- ${key}: ${count}`);
    });
    
    // 2. Clean duplicates from database
    console.log('\n🧹 Cleaning duplicate visitors...');
    
    // Get all visitors grouped by email
    const allVisitors = await prisma.gooseCorpUser.findMany({
      orderBy: { id: 'asc' }
    });
    
    const emailGroups = {};
    allVisitors.forEach(visitor => {
      if (!emailGroups[visitor.email]) {
        emailGroups[visitor.email] = [];
      }
      emailGroups[visitor.email].push(visitor);
    });
    
    // Find and delete duplicates
    let deletedCount = 0;
    for (const [email, visitors] of Object.entries(emailGroups)) {
      if (visitors.length > 1) {
        console.log(`  Found ${visitors.length} visitors with email: ${email}`);
        // Keep the first one, delete the rest
        const toDelete = visitors.slice(1);
        
        for (const visitor of toDelete) {
          // Delete related visits first
          await prisma.visit.deleteMany({
            where: { visitorId: visitor.id }
          });
          
          // Delete visitor
          await prisma.gooseCorpUser.delete({
            where: { id: visitor.id }
          });
          
          deletedCount++;
        }
      }
    }
    
    console.log(`✅ Removed ${deletedCount} duplicate visitors`);
    
    // 3. Fix the seed.js file
    console.log('\n🔧 Fixing seed.js file...');
    
    const seedFilePath = path.join(__dirname, 'src', 'utils', 'seed.js');
    let seedContent = fs.readFileSync(seedFilePath, 'utf8');
    
    // Replace the create() calls with upsert() for visitors
    const fixedSeedContent = seedContent.replace(
      /\/\/ Create sample visitors\s*\n\s*const sampleVisitors = await Promise\.all\(\[\s*\n\s*prisma\.gooseCorpUser\.create\(\{\s*\n\s*data: \{\s*\n\s*firstName: 'Alice',\s*\n\s*lastName: 'Johnson',\s*\n\s*email: 'alice\.johnson@example\.com',\s*\n\s*phone: '\+32 987 654 321',\s*\n\s*company: 'Tech Solutions',\s*\n\s*visitReason: 'MEETING',\s*\n\s*staffId: staffMembers\[0\]\.id,\s*\n\s*status: 'INSIDE',\s*\n\s*checkInTime: new Date\(now\.getTime\(\) - 2 \* 60 \* 60 \* 1000\) \/\/ 2 hours ago\s*\n\s*\}\s*\n\s*\}\),\s*\n\s*prisma\.gooseCorpUser\.create\(\{\s*\n\s*data: \{\s*\n\s*firstName: 'Bob',\s*\n\s*lastName: 'Smith',\s*\n\s*email: 'bob\.smith@example\.com',\s*\n\s*phone: '\+32 987 654 322',\s*\n\s*company: 'Design Agency',\s*\n\s*visitReason: 'FORMATION',\s*\n\s*formationId: formations\[0\]\.id,\s*\n\s*status: 'INSIDE',\s*\n\s*checkInTime: new Date\(now\.getTime\(\) - 1 \* 60 \* 60 \* 1000\) \/\/ 1 hour ago\s*\n\s*\}\s*\n\s*\}\)\s*\n\s*\]\);/g,
      `// Create sample visitors
    const sampleVisitors = await Promise.all([
      prisma.gooseCorpUser.upsert({
        where: { email: 'alice.johnson@example.com' },
        update: {
          firstName: 'Alice',
          lastName: 'Johnson',
          phone: '+32 987 654 321',
          company: 'Tech Solutions',
          visitReason: 'MEETING',
          staffId: staffMembers[0].id,
          status: 'INSIDE',
          checkInTime: new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
        },
        create: {
          firstName: 'Alice',
          lastName: 'Johnson',
          email: 'alice.johnson@example.com',
          phone: '+32 987 654 321',
          company: 'Tech Solutions',
          visitReason: 'MEETING',
          staffId: staffMembers[0].id,
          status: 'INSIDE',
          checkInTime: new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
        }
      }),
      prisma.gooseCorpUser.upsert({
        where: { email: 'bob.smith@example.com' },
        update: {
          firstName: 'Bob',
          lastName: 'Smith',
          phone: '+32 987 654 322',
          company: 'Design Agency',
          visitReason: 'FORMATION',
          formationId: formations[0].id,
          status: 'INSIDE',
          checkInTime: new Date(now.getTime() - 1 * 60 * 60 * 1000) // 1 hour ago
        },
        create: {
          firstName: 'Bob',
          lastName: 'Smith',
          email: 'bob.smith@example.com',
          phone: '+32 987 654 322',
          company: 'Design Agency',
          visitReason: 'FORMATION',
          formationId: formations[0].id,
          status: 'INSIDE',
          checkInTime: new Date(now.getTime() - 1 * 60 * 60 * 1000) // 1 hour ago
        }
      })
    ]);`
    );
    
    // If the regex replacement didn't work, do a simpler replacement
    if (fixedSeedContent === seedContent) {
      console.log('Using fallback replacement method...');
      fixedSeedContent = seedContent
        .replace(/prisma\.gooseCorpUser\.create\(/g, 'prisma.gooseCorpUser.upsert(')
        .replace(/data: \{/g, 'where: { email: visitor.email }, update: visitor_data, create: visitor_data')
        .replace(/visitor_data/g, '{');
      
      // More precise replacement
      const lines = seedContent.split('\n');
      const newLines = [];
      let inVisitorSection = false;
      let visitorCount = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes('// Create sample visitors')) {
          inVisitorSection = true;
          newLines.push(line);
          continue;
        }
        
        if (inVisitorSection && line.includes('prisma.gooseCorpUser.create({')) {
          visitorCount++;
          if (visitorCount === 1) {
            newLines.push(line.replace('create({', 'upsert({'));
            newLines.push("        where: { email: 'alice.johnson@example.com' },");
            newLines.push("        update: {");
            // Skip the 'data: {' line
          } else if (visitorCount === 2) {
            newLines.push(line.replace('create({', 'upsert({'));
            newLines.push("        where: { email: 'bob.smith@example.com' },");
            newLines.push("        update: {");
          }
          continue;
        }
        
        if (inVisitorSection && line.includes('data: {')) {
          newLines.push("        create: {");
          continue;
        }
        
        if (inVisitorSection && line.includes('console.log(')) {
          inVisitorSection = false;
        }
        
        newLines.push(line);
      }
      
      fixedSeedContent = newLines.join('\n');
    }
    
    // Write the corrected file
    fs.writeFileSync(seedFilePath, fixedSeedContent, 'utf8');
    console.log('✅ seed.js file corrected');
    
    // 4. Final state
    console.log('\n📊 Final database state:');
    const finalStats = {
      adminUsers: await prisma.adminUser.count(),
      staff: await prisma.gooseCorpStaff.count(),
      visitors: await prisma.gooseCorpUser.count(),
      formations: await prisma.gooseCorpFormation.count(),
      visits: await prisma.visit.count(),
      logs: await prisma.log.count()
    };
    
    Object.entries(finalStats).forEach(([key, count]) => {
      console.log(`- ${key}: ${count}`);
    });
    
    console.log('\n🎉 Duplicate cleanup and seed fix completed successfully!');
    console.log('💡 You can now run "npm run seed" safely without creating duplicates.');
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSeedAndCleanDuplicates(); 