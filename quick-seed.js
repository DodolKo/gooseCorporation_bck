const { PrismaClient } = require('./src/generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function quickSeed() {
  try {
    console.log('🔑 Ajout rapide de l\'admin...');
    
    const hashedPassword = await bcrypt.hash('Admin123!', 12);
    
    const admin = await prisma.adminUser.upsert({
      where: { email: 'admin@goosecorp.com' },
      update: {},
      create: {
        email: 'admin@goosecorp.com',
        password: hashedPassword,
        name: 'Administrateur Principal',
        role: 'ADMIN',
        isActive: true
      }
    });
    
    console.log('✅ Admin créé avec succès !');
    console.log('📧 Email:', admin.email);
    console.log('🔑 Mot de passe: Admin123!');
    
    // Ajouter aussi un manager
    const managerPassword = await bcrypt.hash('Manager123!', 12);
    const manager = await prisma.adminUser.upsert({
      where: { email: 'manager@goosecorp.com' },
      update: {},
      create: {
        email: 'manager@goosecorp.com',
        password: managerPassword,
        name: 'Gestionnaire',
        role: 'MANAGER',
        isActive: true
      }
    });
    
    console.log('✅ Manager créé avec succès !');
    console.log('📧 Email:', manager.email);
    console.log('🔑 Mot de passe: Manager123!');
    
    console.log('\n🎉 SEEDING TERMINÉ !');
    console.log('================================');
    console.log('🔑 Credentials de test:');
    console.log('   Admin: admin@goosecorp.com / Admin123!');
    console.log('   Manager: manager@goosecorp.com / Manager123!');
    
  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error.message);
    
    if (error.message.includes('connection')) {
      console.error('\n🔧 Vérifiez que:');
      console.error('   1. DATABASE_URL est configuré dans Railway');
      console.error('   2. La base PostgreSQL est accessible');
    }
    
    if (error.message.includes('table')) {
      console.error('\n🔧 Vérifiez que:');
      console.error('   1. Les migrations Prisma sont appliquées');
      console.error('   2. Le client Prisma est généré');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le seeding
quickSeed().catch(console.error); 