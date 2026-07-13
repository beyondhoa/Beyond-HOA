import { useState } from "react";
import { PageHeader, PageContent } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, AlertTriangle, Plus, Trash2, Home, MessageSquarePlus, MessageSquare } from "lucide-react";

interface Violation {
  id: string;
  unit: string;
  type: string;
  fineAmount: number;
  status: string;
  comments: string[]; // Added array to track historical board comments
}

export default function BoardViolationsPage() {
  const [search, setSearch] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [activeViolation, setActiveViolation] = useState<Violation | null>(null);
  const [newComment, setNewComment] = useState("");
  
  // Example data pre-loaded with an initial comment
  const [violations, setViolations] = useState<Violation[]>([
    { id: "1", unit: "4B", type: "Noise Complaint", fineAmount: 50, status: "Open", comments: ["First notice sent to tenant."] },
    { id: "2", unit: "12A", type: "Unapproved Alteration", fineAmount: 250, status: "Open", comments: [] }
  ]);

  const handleDelete = (id: string) => {
    setViolations(violations.filter(v => v.id !== id));
  };

  // Open the dialog for editing/commenting on a specific violation
  const openCommentModal = (v: Violation) => {
    setActiveViolation(v);
    setNewComment("");
    setCommentOpen(true);
  };

  // Handles adding the comment to the state array
  const handleSaveComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeViolation || !newComment.trim()) return;

    setViolations(violations.map(v => {
      if (v.id === activeViolation.id) {
        return {
          ...v,
          comments: [...v.comments, newComment.trim()] // Append the new comment seamlessly
        };
      }
      return v;
    }));

    setCommentOpen(false);
    setActiveViolation(null);
  };

  return (
    <>
      <PageHeader
        title="Board Portal: Violations"
        subtitle="Record, comment on, or dismiss community rule violations"
        action={
          <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            <Plus className="w-4 h-4 mr-2" /> Record New Violation
          </Button>
        }
      />
      <PageContent>
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search by unit or violation type..." 
            className="pl-9" 
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {violations.map((v) => (
                <div key={v.id} className="px-5 py-4 flex flex-col gap-2" data-testid={`row-violation-${v.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="text-destructive w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{v.type}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                          ${v.fineAmount} Fine
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Home className="w-3 h-3" /> Unit {v.unit}
                      </p>
                    </div>
                    
                    {/* Action Controls */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* 📝 EDIT ACTION: Add Board Comment Button */}
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="w-8 h-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openCommentModal(v)}
                        title="Add Comment"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                      </Button>
                      
                      {/* 🔴 DELETE ACTION */}
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="w-8 h-8 text-destructive hover:text-destructive hover:bg-destructive/10" 
                        onClick={() => handleDelete(v.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Inline Timeline Display of existing comments */}
                  {v.comments.length > 0 && (
                    <div className="mt-1 ml-13 bg-muted/50 rounded-lg p-3 space-y-1.5 border border-dashed">
                      <p className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Board Log & Comments:
                      </p>
                      {v.comments.map((comment, idx) => (
                        <p key={idx} className="text-xs text-foreground bg-background p-2 rounded shadow-sm border">
                          {comment}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </PageContent>

      {/* 🛠️ Edit Dialog for Appending Comments */}
      <Dialog open={commentOpen} onOpenChange={(o) => { if (!o) setCommentOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Board Comment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveComment} className="space-y-4 mt-2">
            <div>
              <p className="text-xs text-muted-foreground mb-3">
                Appending notes to <strong>Unit {activeViolation?.unit}</strong> ({activeViolation?.type}). 
                The core fine amount and unit mapping cannot be altered.
              </p>
              <Label htmlFor="comment">Board Internal Notes</Label>
              <Textarea 
                id="comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Type communication log, warning progress, or extension notes..."
                className="mt-1.5 min-h-[100px]"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCommentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Note
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}