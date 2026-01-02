# Development Notes

## Known Issues & Fixes

### Excessive Line Breaks Bug (FIXED)

**Symptom:** The terminal output would show many blank lines (100+ empty lines) between sections during the compression workflow.

**Root Cause:** 
The bug was caused by conditional rendering of spacing elements (`<Box marginTop={1} />`) in the main App component. When a parent conditional evaluated to `true` but nested child content didn't render (due to missing data or additional conditionals), the spacing Box would still render, creating blank lines.

**Example of Problematic Pattern:**
```tsx
// BAD - Can create blank lines if primaryFile is undefined
{files.length > 0 && (
  <>
    <Box marginTop={1} />
    <Text>
      {primaryFile && <Text>{primaryFile.name}</Text>}
    </Text>
  </>
)}
```

**Fixed Pattern:**
```tsx
// GOOD - Box only renders when all required data exists
{files.length > 0 && primaryFile && (
  <>
    <Box marginTop={1} />
    <Text>
      <Text>{primaryFile.name}</Text>
    </Text>
  </>
)}
```

**Prevention Guidelines:**

1. **Ensure complete conditions:** Always check for ALL required data in the outer conditional
   ```tsx
   // Check files.length AND primaryFile AND step
   {files.length > 0 && primaryFile && step !== 'file-input' && (
     // render content
   )}
   ```

2. **Keep spacers with content:** Always wrap spacing Box elements and their content in the SAME fragment with the SAME conditional
   ```tsx
   <>
     <Box marginTop={1} />  {/* Spacer */}
     <Text>Content</Text>   {/* Content */}
   </>
   ```

3. **Avoid nested conditionals with spacers:** Don't split conditionals across spacer and content
   ```tsx
   // BAD
   {condition1 && (
     <>
       <Box marginTop={1} />
       {condition2 && <Text>Content</Text>}
     </>
   )}
   
   // GOOD
   {condition1 && condition2 && (
     <>
       <Box marginTop={1} />
       <Text>Content</Text>
     </>
   )}
   ```

4. **Test edge cases:** Always test with:
   - No files selected
   - Single file vs. batch mode
   - With and without advanced settings
   - Each step transition

**File Locations:**
- Main render logic: `src/App.tsx` (lines 210-372)
- Comments added: Look for "IMPORTANT: Preventing Excessive Line Breaks Bug"

**Date Fixed:** January 2026

---

## Development Best Practices

### Ink Component Rendering

When working with Ink (React for CLI), be extra careful with conditional rendering:

1. **Static vs Dynamic:** Use `<Static>` for content that should persist (like the welcome message)
2. **Step-based rendering:** Only ONE main component should render per step
3. **Spacing:** Use `marginTop` and `marginBottom` sparingly and always within proper conditionals
4. **Terminal width:** Always check `stdout.columns` for responsive layouts

### Testing Changes

Before committing, test the full workflow:
```bash
npm run build
sqsh  # or your test command
```

Test scenarios:
- Single image compression
- Batch image compression
- Single video compression
- With advanced settings
- With target size
- With format conversion
- Ctrl+C exit at each step

