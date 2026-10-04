export type ConsultancyType = "one-to-one" | "private-case";
export type ConsultancyStatus = "open" | "in_progress" | "closed";

export type ConsultancyReply = {
  at: string;
  from: "student" | "staff";
  body: string;
};

export type ConsultancyCase = {
  id: string;
  studentId: string;
  type: ConsultancyType;
  topic: string;
  message: string;
  status: ConsultancyStatus;
  createdAt: string;
  replies: ConsultancyReply[];
};
