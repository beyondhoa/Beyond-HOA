import { useState, useEffect } from "react";
import { PageHeader, PageContent } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Vote } from "lucide-react";

interface Proposal {
  id: string;
  title: string;
  description: string;
  deadline: string;
}

const PROPOSALS: Proposal[] = [
  {
    id: "pool-hours",
    title: "Extended Pool Hours on Weekends",
    description:
      "Proposal to extend pool operating hours from 8am–8pm to 7am–10pm on Saturdays and Sundays during summer months (June–August). This would allow residents more flexibility for morning and evening swims.",
    deadline: "July 31, 2026",
  },
  {
    id: "parking-rules",
    title: "Guest Parking 48-Hour Limit",
    description:
      "Amend the parking policy to limit guest vehicle parking to a maximum of 48 consecutive hours in any 7-day period. Vehicles exceeding this limit would be subject to a warning notice before towing.",
    deadline: "August 15, 2026",
  },
  {
    id: "landscaping-budget",
    title: "Landscaping Budget Increase (15%)",
    description:
      "Approve an increase to the annual landscaping budget from $42,000 to $48,300 to cover rising costs and add seasonal flowering plants along the main entrance and courtyard.",
    deadline: "August 30, 2026",
  },
];

type VoteChoice = "yes" | "no" | "abstain";
type VotesState = Record<string, VoteChoice>;

const STORAGE_KEY = "hoa_votes";

function loadVotes(): VotesState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function tally(votes: VotesState, proposalId: string) {
  // Simulate community votes — seeded deterministically per proposal
  const seeds: Record<string, { yes: number; no: number; abstain: number }> = {
    "pool-hours": { yes: 34, no: 12, abstain: 5 },
    "parking-rules": { yes: 28, no: 21, abstain: 3 },
    "landscaping-budget": { yes: 19, no: 30, abstain: 8 },
  };
  const base = seeds[proposalId] ?? { yes: 10, no: 10, abstain: 2 };
  const myVote = votes[proposalId];
  return {
    yes: base.yes + (myVote === "yes" ? 1 : 0),
    no: base.no + (myVote === "no" ? 1 : 0),
    abstain: base.abstain + (myVote === "abstain" ? 1 : 0),
  };
}

export default function VotingPage() {
  const [votes, setVotes] = useState<VotesState>(loadVotes);

  const vote = (proposalId: string, choice: VoteChoice) => {
    setVotes((prev) => {
      const next = { ...prev, [proposalId]: choice };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <>
      <PageHeader
        title="Community Voting"
        subtitle="Cast your vote on current HOA proposals"
      />
      <PageContent>
        <div className="space-y-5">
          {PROPOSALS.map((proposal) => {
            const myVote = votes[proposal.id];
            const counts = tally(votes, proposal.id);
            const total = counts.yes + counts.no + counts.abstain;

            return (
              <Card key={proposal.id} data-testid={`card-proposal-${proposal.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-base">{proposal.title}</CardTitle>
                    {myVote && (
                      <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                        <CheckCircle className="w-3 h-3" />
                        Voted: {myVote.charAt(0).toUpperCase() + myVote.slice(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Deadline: {proposal.deadline}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{proposal.description}</p>

                  <div className="mb-5 space-y-2">
                    {(["yes", "no", "abstain"] as VoteChoice[]).map((choice) => {
                      const count = counts[choice];
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      const colors: Record<VoteChoice, string> = {
                        yes: "bg-green-500",
                        no: "bg-red-500",
                        abstain: "bg-gray-400",
                      };
                      return (
                        <div key={choice} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-12 capitalize">{choice}</span>
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${colors[choice]}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-12 text-right">{count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>

                  {!myVote ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
                        onClick={() => vote(proposal.id, "yes")}
                        data-testid={`button-vote-yes-${proposal.id}`}
                      >
                        Yes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => vote(proposal.id, "no")}
                        data-testid={`button-vote-no-${proposal.id}`}
                      >
                        No
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => vote(proposal.id, "abstain")}
                        data-testid={`button-vote-abstain-${proposal.id}`}
                      >
                        Abstain
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="text-xs text-muted-foreground underline"
                      onClick={() => {
                        const next = { ...votes };
                        delete next[proposal.id];
                        setVotes(next);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                      }}
                      data-testid={`button-change-vote-${proposal.id}`}
                    >
                      Change my vote
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageContent>
    </>
  );
}
