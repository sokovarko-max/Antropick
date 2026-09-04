Icons are generated from `app-icon.png` (the 1024×1024 source, kept here) with:

```
pnpm tauri icon src-tauri/icons/app-icon.png
```

Re-run that after changing the source. The Android/iOS output the generator
also produces is deleted — this project targets Windows desktop first (see
docs/architecture.md §3), so those sets would be dead weight in the repo.
