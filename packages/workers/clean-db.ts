import { db, mentions, classifications, clusters, clusterMentions, redditSources, competitors, ingestionJobs, users, workspaces, workspaceMembers } from "@rivaleye/db";

async function cleanDB() {
  try {
    console.log("Deleting cluster mentions...");
    await db.delete(clusterMentions);
    
    console.log("Deleting clusters...");
    await db.delete(clusters);
    
    console.log("Deleting classifications...");
    await db.delete(classifications);
    
    console.log("Deleting mentions...");
    await db.delete(mentions);
    
    console.log("Deleting ingestion jobs...");
    await db.delete(ingestionJobs);
    
    console.log("Deleting reddit sources...");
    await db.delete(redditSources);
    
    console.log("Deleting competitors...");
    await db.delete(competitors);
    
    console.log("Deleting workspace members...");
    await db.delete(workspaceMembers);
    
    console.log("Deleting workspaces...");
    await db.delete(workspaces);
    
    console.log("Deleting users...");
    await db.delete(users);
    
    console.log("✓ Database cleaned!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

cleanDB();
