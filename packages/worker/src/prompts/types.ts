export interface Stage1Post {
  id: string;
  body: string;
  title: string;
  score: number;
  created_utc: number;
}

export interface Stage1Input {
  posts: Stage1Post[];
  competitor: string;
  category: string;
}

export interface Stage2Cluster {
  id: string;
  title: string;
  description: string;
  top_quotes: string[];
}

export interface Stage2Input {
  clusters: Stage2Cluster[];
}

export interface Stage3RankedCluster {
  id: string;
  title: string;
  description: string;
  pain_score: number;
  evidence_post_ids: string[];
  voice_phrases: string[];
}

export interface Stage3Input {
  rankedClusters: Stage3RankedCluster[];
  competitor: string;
  category: string;
  founderGoal: string;
}

export interface Stage4Summary {
  topOpportunities: string[];
  bestWedge: string;
  topPainClusters: string[];
}

export interface Stage4Input {
  stage3Summary: Stage4Summary;
  founderGoal: string;
  competitor: string;
}
