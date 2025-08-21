require('dotenv').config();
const { migrateAllUserImages, migrateUserImages } = require('../utils/migrationUtil');

/**
 * Parse command line arguments
 * @returns {Object} Command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsedArgs = {
    userId: null,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--userId=')) {
      parsedArgs.userId = arg.split('=')[1];
    } else if (arg === '--userId' && i + 1 < args.length) {
      // Handle --userId followed by the actual ID
      parsedArgs.userId = args[i + 1];
      i++; // Skip the next argument since we've consumed it
    } else if (arg === '--dry-run') {
      parsedArgs.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      parsedArgs.help = true;
    }
  }

  return parsedArgs;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Usage: node migrateImages.js [options]

Options:
  --userId=<id>    Migrate images for a specific user ID (format 1)
  --userId <id>    Migrate images for a specific user ID (format 2)
  --dry-run        Simulate migration without making changes
  --help, -h       Show this help message
`);
}

/**
 * Script to migrate existing images from local filesystem to Firebase Storage
 */
async function runMigration() {
  const args = parseArgs();
  
  if (args.help) {
    printUsage();
    return;
  }
  
  console.log('Starting image migration to Firebase Storage...');
  console.log(`Mode: ${args.dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE MIGRATION'}`);
  
  if (args.userId) {
    console.log(`Target: Single user (${args.userId})`);
  } else {
    console.log('Target: All users');
  }
  
  try {
    let result;
    
    // If dry run, just simulate the process
    if (args.dryRun) {
      console.log('Simulating migration process...');
      // In dry run mode, we'll still analyze the data but not make changes
      if (args.userId) {
        // For a specific user in dry run, just log what would be done
        console.log(`Would migrate images for user ${args.userId}`);
        // We could implement a "preview" function that doesn't make changes
        // but for now we'll just show a message
        console.log('Dry run complete. No changes were made.');
        return;
      } else {
        console.log('Would migrate images for all users');
        console.log('Dry run complete. No changes were made.');
        return;
      }
    }
    
    // Real migration process
    if (args.userId) {
      console.log(`Migrating images for user ${args.userId}...`);
      result = await migrateUserImages(args.userId);
      
      if (result.success) {
        console.log(`\n✅ Successfully migrated images for user ${args.userId}`);
        const userImages = result.result.user.profileImage ? 1 : 0 + 
                         result.result.user.companyLogo ? 1 : 0;
        
        let cardImages = 0;
        result.result.cards.forEach(card => {
          cardImages += card.profileImage ? 1 : 0;
          cardImages += card.companyLogo ? 1 : 0;
        });
        
        console.log(`User profile: ${result.result.user.profileImage ? '✅' : '❌'} Profile Image, ${result.result.user.companyLogo ? '✅' : '❌'} Company Logo`);
        console.log(`Cards: ${result.result.cards.length} cards processed, ${cardImages} images migrated`);
      } else {
        console.error(`\n❌ Failed to migrate images for user ${args.userId}:`, result.message);
      }
    } else {
      // Run migration for all users
      console.log('Migrating images for all users...');
      result = await migrateAllUserImages();
      
      if (result.success) {
        console.log(`\nMigration successful! ${result.results.length} users processed.`);
        
        // Log detailed results
        console.log('\nMigration Summary:');
        console.log('------------------');
        
        let totalImages = 0;
        let failedUsers = 0;
        
        result.results.forEach(userResult => {
          if (!userResult.success) {
            console.log(`❌ User ${userResult.userId}: ${userResult.message}`);
            failedUsers++;
            return;
          }
          
          const userImages = userResult.result.user.profileImage ? 1 : 0 + 
                           userResult.result.user.companyLogo ? 1 : 0;
          
          let cardImages = 0;
          userResult.result.cards.forEach(card => {
            cardImages += card.profileImage ? 1 : 0;
            cardImages += card.companyLogo ? 1 : 0;
          });
          
          const totalUserImages = userImages + cardImages;
          totalImages += totalUserImages;
          
          console.log(`✅ User ${userResult.userId}: ${totalUserImages} images migrated (${userImages} user, ${cardImages} cards)`);
        });
        
        console.log('\nTotal Images Migrated:', totalImages);
        console.log('Failed Users:', failedUsers);
        console.log('Success Rate:', `${(1 - failedUsers / result.results.length) * 100}%`);
      } else {
        console.error('Migration failed:', result.message);
        if (result.error) {
          console.error('Error details:', result.error);
        }
      }
    }
  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  }
  
  console.log('\nMigration process completed.');
}

// Run the migration script
runMigration().catch(err => {
  console.error('Unhandled error in migration script:', err);
  process.exit(1);
}); 