import express from "express";
import bodyParser from "body-parser";
import { dirname } from "path";
import { fileURLToPath } from "url";

const app = express();
const port = 3000;

const __dirname = dirname(fileURLToPath(import.meta.url));

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

const PREVIEW_MAX_LENGTH = 160;

app.locals.formatDate = (iso) => {
    if (!iso) return "Unknown date";
    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(iso));
};

app.locals.truncatePreview = (text, maxLength = PREVIEW_MAX_LENGTH) => {
    const content = text || "";
    if (content.length <= maxLength) {
        return { preview: content, isTruncated: false };
    }
    let cut = content.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > maxLength * 0.6) {
        cut = cut.slice(0, lastSpace);
    }
    return { preview: cut.trimEnd() + "…", isTruncated: true };
};

// In-memory storage (NO DB)
let posts = [];

const SORT_OPTIONS = ["newest", "oldest", "title-az", "title-za"];
const FIELD_OPTIONS = ["all", "title", "content"];

function searchPosts(postList, query, field = "all") {
    const q = query.trim().toLowerCase();
    if (!q) return postList;

    return postList.filter((post) => {
        const title = (post.title || "").toLowerCase();
        const content = (post.content || "").toLowerCase();
        if (field === "title") return title.includes(q);
        if (field === "content") return content.includes(q);
        return title.includes(q) || content.includes(q);
    });
}

function sortPosts(postList, sort) {
    const sorted = [...postList];
    switch (sort) {
        case "oldest":
            return sorted.sort(
                (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
            );
        case "title-az":
            return sorted.sort((a, b) =>
                (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" })
            );
        case "title-za":
            return sorted.sort((a, b) =>
                (b.title || "").localeCompare(a.title || "", undefined, { sensitivity: "base" })
            );
        case "newest":
        default:
            return sorted.sort(
                (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            );
    }
}

app.get("/", (req, res) => {
    const q = String(req.query.q || "").trim();
    const sort = SORT_OPTIONS.includes(req.query.sort) ? req.query.sort : "newest";
    const field = FIELD_OPTIONS.includes(req.query.field) ? req.query.field : "all";

    const filtered = sortPosts(searchPosts(posts, q, field), sort);
    const hasFilters = q.length > 0 || sort !== "newest" || field !== "all";

    res.render("index.ejs", {
        posts: filtered,
        q,
        sort,
        field,
        totalPosts: posts.length,
        hasFilters,
    });
});

app.get("/create", (req, res) => {
    res.render("create.ejs");
})

app.post("/create", (req, res) => {
    const title = req.body["title"];
    const content = req.body["content"];

    const newPost = {
        id: Date.now(),
        title: title,
        content: content,
        createdAt: new Date().toISOString(),
    };

    posts.push(newPost);
    res.redirect("/");
});

app.get("/post/:id", (req, res) => {
    const post = posts.find((p) => p.id == req.params.id);
    if (!post) {
        return res.status(404).render("404.ejs", { message: "Post not found." });
    }
    res.render("show.ejs", { post });
});

app.get("/edit/:id", (req, res) => {
    const post = posts.find(p => p.id == req.params.id);
    if (!post) {
        return res.status(404).render("404.ejs", { message: "Post not found." });
    }
    res.render("edit.ejs", { post });
});

app.post("/edit/:id", (req, res) => {
    const title = req.body["title"];
    const content = req.body["content"];

    const post = posts.find(p => p.id == req.params.id);

    post.title = title;
    post.content = content;

    res.redirect(`/post/${post.id}`);
});

app.post("/delete/:id", (req, res) => {
    posts = posts.filter(p => p.id != req.params.id);
    res.redirect("/");
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});