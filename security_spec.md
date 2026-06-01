# Security Specification for Community Features

## Data Invariants
1. A Shared Course must link to a valid Course owned by the creator.
2. Sharing a course is irreversible (Write operations for delete on /shared_courses are forbidden).
3. A user can only have one like/dislike per lesson and one comment per lesson.
4. A user can only delete their own comment.
5. Likes/dislikes counts must remain consistent with user interaction maps.

## The "Dirty Dozen" Payloads
*(Simulated for planning - will be implemented in test suite)*
1. Attempting to update a public course description without being the owner.
2. Attempting to delete a public course (forbidden).
3. Attempting to add a second comment on the same lesson by the same user.
4. Attempting to delete someone else's comment.
5. Attempting to inject a 200-character ID into a commentId.
6. Attempting to set `likesCount` manually in the payload (should be updated via server/rules logic).
7. Attempting to set `courseId` to an invalid ID format.
8. Attempting to comment as an unauthenticated user.
9. Attempting to like a course as an unverified user.
10. Attempting to set `creatorId` to someone else's UID.
11. Attempting to update `createdAt` of a comment.
12. Attempting to update `userId` of a comment.
