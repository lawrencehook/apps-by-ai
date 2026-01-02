# Todo

- [x] Fix up the countdown app - make the actual countdown take up more space and be at the top of the page
- [x] Brainstorm more usages of the D3 library
- [x] Simple app that displays text as a banner, also self-edits the title to show the text when tabbed away
- [x] Data explorer - basic stats and analysis on CSV data

---

## D3.js App Ideas (Brainstormed)

Prioritized by: 1) Utility, 2) Visual Impact

| # | App Name | Utility | Visual | Total |
|---|----------|---------|--------|-------|
| 1 | Network Graph Explorer | 4 | 5 | 9 |
| 2 | Treemap File Size Analyzer | 5 | 4 | 9 |
| 3 | Radial Sunburst Navigator | 4 | 5 | 9 |
| 4 | Interactive Bubble Chart Timeline | 4 | 5 | 9 |
| 5 | Chord Diagram Relationship Mapper | 3 | 5 | 8 |
| 6 | Time Series Brush/Zoom Chart | 5 | 3 | 8 |
| 7 | Word Cloud Generator | 4 | 4 | 8 |
| 8 | Collapsible Force Tree | 4 | 4 | 8 |
| 9 | Heatmap Calendar (GitHub-style) | 5 | 3 | 8 |
| 10 | Contour/Density Plot | 3 | 5 | 8 |

### Details

**1. Network Graph Explorer** (Utility: 4, Visual: 5)
Interactive force-directed graph where users can add nodes, create connections, and watch the network self-organize. Nodes can be dragged, and connections form/break with animations. D3's force simulation is the gold standard for network layouts with physics-based positioning.

**2. Treemap File Size Analyzer** (Utility: 5, Visual: 4)
Drag and drop a folder or paste file data to see a zoomable treemap visualization of storage usage. Click to drill down into subdirectories. D3's hierarchical layouts excel at showing nested data with smooth zoom transitions.

**3. Radial Sunburst Navigator** (Utility: 4, Visual: 5)
Explore hierarchical data (file systems, taxonomies, budgets) as an animated sunburst chart. Click segments to zoom and focus. Sunburst is a D3 specialty with arc tweening and hierarchical data binding.

**4. Interactive Bubble Chart Timeline** (Utility: 4, Visual: 5)
Animated bubble chart showing entities changing over time (like Gapminder). Play/pause controls, year scrubber, hover details. D3 excels at data-driven transitions where bubbles smoothly animate between states.

**5. Chord Diagram Relationship Mapper** (Utility: 3, Visual: 5)
Visualize many-to-many relationships as an interactive chord diagram. Pre-loaded with examples (trade flows, migration, dependencies) or user-editable. D3's chord layout creates elegant arc transitions.

**6. Time Series Brush/Zoom Chart** (Utility: 5, Visual: 3)
Stock-chart style visualization with brushable range selector. Paste CSV data or use sample datasets. Supports annotations and moving averages. D3's brush and zoom behaviors are ideal for time series.

**7. Word Cloud Generator** (Utility: 4, Visual: 4)
Paste text and watch a word cloud animate into place. Adjustable word count, colors, and shapes. Export as SVG/PNG. Uses D3-cloud plugin with collision detection.

**8. Collapsible Force Tree** (Utility: 4, Visual: 4)
Expandable/collapsible tree with force-directed physics. Nodes smoothly animate when branches expand or collapse. Great for org charts, family trees. Combines D3's tree layout with force simulation.

**9. Heatmap Calendar (GitHub-style)** (Utility: 5, Visual: 3)
Input data (habits, commits, workouts) and visualize as a year-long heatmap grid. Interactive tooltips, color scales, and streak detection. Perfect for D3's data join pattern.

**10. Contour/Density Plot Generator** (Utility: 3, Visual: 5)
Upload or generate 2D point data and visualize as smooth contour/density plots. Adjustable thresholds, colorful topographic-style output. D3-contour module creates beautiful density visualizations.
