# Firebase Google Authentication Architecture

Firebase handles client-side authentication by abstracting OAuth 2.0 flows entirely into the Google Sign-In SDK (Bačanin Džakula, 2024). When a user logs in via Google, Firebase processes the authentication token natively and yields an isolated Identity Token (JWT). This identity state is implicitly propagated down through every client-side database interaction.

Inside Cloud Firestore Security Rules, the verified payload is exposed dynamically via the `request.auth` object:

* `request.auth.uid`: The unique, immutable identifier assigned to the Google user.
* `request.auth.token.email`: The verified email address from the Google account.
* `request.auth.token.firebase.sign_in_provider`: Explicitly set to `google.com`.

---

## Data Modeling for Group Separation

Because Firestore is a NoSQL Document Store, your security rules depend entirely on how you lay out your data paths (Demissie & Ranise, 2021). For robust group access control without leaking data between disparate users, implement the **Isolated Document Metadata** architecture pattern (Alam, 2024).

### Document Architecture Path

1. **`/users/{userId}`**: Stores profile metadata for individuals.
2. **`/groups/{groupId}`**: Defines a group document containing general metadata.
3. **`/groups/{groupId}/members/{userId}`**: A subcollection strategy acting as a junction table. If a document path exists here, that user belongs to that specific group.
4. **`/appData/{documentId}`**: The collection containing personal or shared app payloads.

#### The Data Document Payload Structure (`/appData/{documentId}`)

```json
{
  "ownerId": "google_user_uid_123",
  "groupId": "engineering_team_789",
  "isSharedWithGroup": true,
  "content": {
    "appSpecificKey": "value"
  }
}
```

---

## Advanced Firestore Security Rules Setup

To enforce multi-tenant separation at the server level, your rule logic must evaluate two conditions: ownership verification, and dynamic cross-document lookups (Alam, 2024). Paste this configuration directly into your `firestore.rules` file:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function: Checks if the incoming request is fully authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper function: Checks if the user is the explicit owner of the document
    function isOwner(resourceData) {
      return request.auth.uid == resourceData.ownerId;
    }

    // Helper function: Performs a live lookup to verify group membership
    function isGroupMember(groupId) {
      return exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
    }

    // Application Data Collection Rules
    match /appData/{documentId} {
      
      // Allow reads if the requesting user owns it OR is an active member of the designated group
      allow read: if isAuthenticated() && (
        isOwner(resource.data) || 
        (resource.data.isSharedWithGroup == true && isGroupMember(resource.data.groupId))
      );

      // Prevent users from fabricating ownership metrics or hijacking data creation
      allow create: if isAuthenticated() && 
        request.resource.data.ownerId == request.auth.uid;

      // Allow updates/deletes strictly to the original creator
      allow update, delete: if isAuthenticated() && isOwner(resource.data);
    }

    // Group Subcollection Management
    match /groups/{groupId}/members/{userId} {
      // Users can see group structures if they belong to them
      allow read: if isAuthenticated() && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
    }
  }
}
```

---

## Critical Constraints: "Rules Are Not Filters"

A common architectural failure point occurs when developers assume Firestore filters out unreadable data automatically based on security configurations (Firebase Docs). **Firestore security rules do not act as filters.**

If you attempt to fetch *all* documents in `appData`, the query will immediately fail with a `Permission Denied` error code because Firestore evaluates the rule against the *possibility* of finding a document you don't own (Firebase Docs).

### The Invalidation Pitfall (Will Fail)

```javascript
// This SDK call will fail instantly because it lacks constraints
const querySnapshot = await getDocs(collection(db, "appData"));
```

### The Correct Structural Query (Will Succeed)

To comply with the rule evaluation engine, your client code must query *only* the specific rows allowed by the backend rule framework (Firebase Docs):

```javascript
import { query, collection, where, or, getDocs } from "firebase/firestore";

// Query strictly matches the security allowance boundary
const secureQuery = query(
  collection(db, "appData"),
  or(
    where("ownerId", "==", currentUser.uid),
    where("groupId", "in", userGroupListArray)
  )
);

const querySnapshot = await getDocs(secureQuery);
```

---

## Cost and Performance Optimization for the Free Tier

Every time an `exists()` or `get()` function executes inside a Cloud Firestore security rule to check group paths, it counts as an additional document read operation (Alam, 2024). Under the Spark Free Plan's limit of **50,000 reads per day**, a poorly designed web application can exhaust its free allocation quickly.

### Free Tier Preservation Strategy

* **Cache User Group Memberships locally:** Do not make individual document calls to verify membership on every viewport render. Fetch the user's active groups list *once* upon application initialization and reuse it to drive targeted UI parameters.
* **Avoid complex multi-level nested queries:** Keep your access tokens flat. If group topologies remain small, consider passing a list of authorized groups directly into custom claims using Firebase Auth blocking functions to eliminate database-level lookups during rule evaluation.
