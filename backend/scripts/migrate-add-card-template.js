/*
  Firestore backfill: add numeric template to all cards
  Usage:
    node backend/scripts/migrate-add-card-template.js --dry-run
    node backend/scripts/migrate-add-card-template.js
*/

const { db, admin } = require('../firebase');

async function run() {
  const isDryRun = process.argv.includes('--dry-run');
  const cardsRef = db.collection('cards');
  const snapshot = await cardsRef.get();

  let docsVisited = 0;
  let docsUpdated = 0;
  let cardsScanned = 0;
  let cardsModified = 0;

  for (const doc of snapshot.docs) {
    docsVisited++;
    const data = doc.data();
    const cards = Array.isArray(data.cards) ? data.cards : [];
    cardsScanned += cards.length;

    let modified = false;
    const updatedCards = cards.map((card) => {
      const hasValidTemplate = Number.isInteger(card?.template) && card.template >= 1;
      if (!hasValidTemplate) {
        modified = true;
        cardsModified++;
        return {
          ...card,
          template: 1,
        };
      }
      return card;
    });

    if (modified) {
      if (isDryRun) {
        console.log(`[DRY-RUN] Would update doc ${doc.id}: set template=1 on ${updatedCards.filter(c => c.template === 1).length} card(s)`);
      } else {
        await cardsRef.doc(doc.id).update({ cards: updatedCards });
        docsUpdated++;
        console.log(`Updated doc ${doc.id}`);
      }
    }
  }

  console.log('\n=== Migration Summary ===');
  console.log('Docs visited:', docsVisited);
  console.log('Docs updated:', docsUpdated);
  console.log('Cards scanned:', cardsScanned);
  console.log('Cards modified:', cardsModified);
}

run()
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });



