# NPC Notice Board — Next.js Migration Progress

## Conversation 1: Foundation ✅
Everything below is **COMPLETE** and **VERIFIED** (build passes, visual check passed):

### Files Created
| File | Purpose | Status |
|------|---------|--------|
| `src/lib/firebase.ts` | Firebase config + initialization (Auth, Firestore, RTDB) | ✅ |
| `src/context/AuthContext.tsx` | Auth state, login methods, profile save, logout logic | ✅ |
| `src/context/ThemeContext.tsx` | Dark/light mode toggle with localStorage persistence | ✅ |
| `src/context/UIContext.tsx` | Toast notifications + Custom Alert modal system | ✅ |
| `src/components/AuthOverlay.tsx` | Login, register, email verification, profile setup overlay | ✅ |
| `src/components/Header.tsx` | Desktop header with nav tabs, profile, theme toggle, logout | ✅ |
| `src/components/BottomNav.tsx` | Mobile bottom navigation (Notices, Routine, Material, Social) | ✅ |
| `src/components/AppShell.tsx` | App shell with view switching + placeholder views | ✅ |
| `src/app/globals.css` | Complete design system (Tailwind v4 + neubrutalist CSS) | ✅ |
| `src/app/layout.tsx` | Root layout with Inter + JetBrains Mono fonts | ✅ |
| `src/app/page.tsx` | Main page composing all providers + components | ✅ |

### Features Migrated
- [x] Firebase initialization (modular v9+ SDK)
- [x] Google Sign-In (popup flow)
- [x] Email/Password login with domain restriction check
- [x] Email/Password registration with verification email
- [x] Email verification status check + resend
- [x] Profile setup with dynamic department fetching from Firestore
- [x] Password linking for Google users (with re-auth fallback)
- [x] Cancel registration (delete user + sign out)
- [x] Blocked user detection + force logout
- [x] Global settings listener (restrictGmail, studentGoogleOnly, allowLogout)
- [x] Logout with allowLogout permission check
- [x] Dark mode toggle with localStorage persistence
- [x] Toast notifications
- [x] Custom alert modal (info, error, success, warning types)
- [x] Desktop header with nav tabs + active underline animation
- [x] Desktop profile display (avatar, name, dept/sem)
- [x] Chat toggle button with badge
- [x] Theme toggle button (sun/moon icons)
- [x] Conditional logout button
- [x] Mobile bottom nav with 4 tabs + active state (purple glow)
- [x] Social tab badge counter
- [x] View switching (translate-x transitions between views)
- [x] Chat slide-in overlay
- [x] Notice view with desktop sidebar (category filters) + mobile filter tabs
- [x] Placeholder views for Routine, Material, Chat

---

## Conversation 2: Notice Board (PENDING)
- [ ] Notice card component
- [ ] Notice feed with real-time Firestore listener
- [ ] Category filtering (desktop sidebar + mobile tabs)
- [ ] Image collage layouts (grid, hero, masonry)
- [ ] Image lightbox
- [ ] Custom video player
- [ ] Notice modal (single notice detail view)
- [ ] Share notice modal
- [ ] CR create notice modal
- [ ] Delete notice confirmation
- [ ] Scroll to top button

## Conversation 3: Routine (PENDING)
- [ ] Routine grid view
- [ ] Routine cell styling + hover effects
- [ ] Routine edit modal
- [ ] Routine prompt modal
- [ ] Day/time grid layout

## Conversation 4: Materials (PENDING)
- [ ] Material hub cards
- [ ] Material upload modal
- [ ] Material filtering/search
- [ ] File download/preview

## Conversation 5: Chat & Social (PENDING)
- [ ] Chat sidebar with tabs (Recent, Admin, Teacher, Groups)
- [ ] Chat message view
- [ ] Message actions toolbar
- [ ] Edit message modal
- [ ] Global group chat
- [ ] Class group chat
- [ ] Group chat icons (global icon loading)
- [ ] Real-time chat listeners

## Conversation 6: Profile & Settings (PENDING)
- [ ] Edit profile modal
- [ ] View peer profile modal
- [ ] Selection modal (custom dropdown)
- [ ] Settings popup

## Conversation 7: Polish (PENDING)
- [ ] Digital/Retro theme styles
- [ ] Glitch animations
- [ ] Remaining utility functions
- [ ] Mobile responsiveness audit
- [ ] Performance optimization
