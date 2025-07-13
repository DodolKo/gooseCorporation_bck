const bcrypt = require('bcryptjs');
const prisma = require('../config/database');

async function seed() {
  try {
    console.log('🌱 Starting database seeding...');

    // Create admin user with strong password
    const hashedPassword = await bcrypt.hash('Admin123!', 12);
    const admin = await prisma.adminUser.upsert({
      where: { email: 'admin@goosecorp.com' },
      update: {},
      create: {
        email: 'admin@goosecorp.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'ADMIN',
        isActive: true
      }
    });
    console.log('✅ Admin user created:', admin.email);

    // Create additional admin users with strong passwords
    const manager = await prisma.adminUser.upsert({
      where: { email: 'manager@goosecorp.com' },
      update: {},
      create: {
        email: 'manager@goosecorp.com',
        password: await bcrypt.hash('Manager123!', 12),
        name: 'Manager User',
        role: 'MANAGER',
        isActive: true
      }
    });
    console.log('✅ Manager user created:', manager.email);

    // Create staff members
    const staffMembers = await Promise.all([
      prisma.gooseCorpStaff.upsert({
        where: { email: 'john.doe@goosecorp.com' },
        update: {},
        create: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@goosecorp.com',
          phone: '+32 123 456 789',
          department: 'IT',
          office: 'Bureau 101',
          position: 'Développeur Senior',
          isActive: true
        }
      }),
      prisma.gooseCorpStaff.upsert({
        where: { email: 'jane.smith@goosecorp.com' },
        update: {},
        create: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@goosecorp.com',
          phone: '+32 123 456 790',
          department: 'RH',
          office: 'Bureau 202',
          position: 'Responsable RH',
          isActive: true
        }
      }),
      prisma.gooseCorpStaff.upsert({
        where: { email: 'mike.wilson@goosecorp.com' },
        update: {},
        create: {
          firstName: 'Mike',
          lastName: 'Wilson',
          email: 'mike.wilson@goosecorp.com',
          phone: '+32 123 456 791',
          department: 'Marketing',
          office: 'Bureau 303',
          position: 'Chef de projet Marketing',
          isActive: true
        }
      }),
      prisma.gooseCorpStaff.upsert({
        where: { email: 'sarah.johnson@goosecorp.com' },
        update: {},
        create: {
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'sarah.johnson@goosecorp.com',
          phone: '+32 123 456 792',
          department: 'Finance',
          office: 'Bureau 404',
          position: 'Comptable',
          isActive: true
        }
      })
    ]);
    console.log('✅ Staff members created:', staffMembers.length);

    // Create formations
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const formations = await Promise.all([
      prisma.gooseCorpFormation.upsert({
        where: { id: 1 },
        update: {},
        create: {
          name: 'Formation Sécurité',
          description: 'Formation sur les règles de sécurité du bâtiment',
          location: 'Salle de formation A',
          startDate: tomorrow,
          endDate: new Date(tomorrow.getTime() + 4 * 60 * 60 * 1000), // 4 hours later
          maxAttendees: 20,
          instructor: 'Jean Dupont',
          isActive: true
        }
      }),
      prisma.gooseCorpFormation.upsert({
        where: { id: 2 },
        update: {},
        create: {
          name: 'Formation Logiciels',
          description: 'Formation sur les outils informatiques',
          location: 'Salle informatique B',
          startDate: nextWeek,
          endDate: new Date(nextWeek.getTime() + 6 * 60 * 60 * 1000), // 6 hours later
          maxAttendees: 15,
          instructor: 'Marie Martin',
          isActive: true
        }
      }),
      prisma.gooseCorpFormation.upsert({
        where: { id: 3 },
        update: {},
        create: {
          name: 'Réunion Équipe',
          description: 'Réunion hebdomadaire de l\'équipe',
          location: 'Salle de réunion C',
          startDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // day after tomorrow
          endDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // 2 hours later
          maxAttendees: 10,
          instructor: 'Pierre Durand',
          isActive: true
        }
      })
    ]);
    console.log('✅ Formations created:', formations.length);

    // Create sample visitors
    const sampleVisitors = await Promise.all([
      prisma.gooseCorpUser.create({
        data: {
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
      prisma.gooseCorpUser.create({
        data: {
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
    ]);
    console.log('✅ Sample visitors created:', sampleVisitors.length);

    // Create visit history
    for (const visitor of sampleVisitors) {
      await prisma.visit.create({
        data: {
          visitorId: visitor.id,
          action: 'CHECK_IN',
          timestamp: visitor.checkInTime,
          details: `Checked in for ${visitor.visitReason}`,
          staffId: visitor.staffId,
          formationId: visitor.formationId
        }
      });
    }
    console.log('✅ Visit history created');

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Default credentials:');
    console.log('Admin: admin@goosecorp.com / Admin123!');
    console.log('Manager: manager@goosecorp.com / Manager123!');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed(); 