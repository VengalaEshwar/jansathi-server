import Scheme from "../models/scheme.model.js"

// GET /api/schemes?page=1&limit=10&search=&category=&state=&level=
export const getSchemes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      category = "",
      state = "",
      level = "",
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    // Text search
    if (search.trim()) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    // Filters
    if (category) query.category = { $in: [category] };
    if (state) query.state = { $in: [state, "All"] };
    if (level) query.level = level;

    const [schemes, total] = await Promise.all([
      Scheme.find(query).skip(skip).limit(parseInt(limit)).lean(),
      Scheme.countDocuments(query),
    ]);

    res.json({
      schemes,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/schemes/eligible
export const getEligibleSchemes = async (req, res) => {
  try {
    const {
      age,
      gender,
      caste,
      state,
      occupation,
      income,
      isDisabled,
      isStudent,
      isVeteran,
    } = req.body;

    const tagFilters = [];

    // Gender
    if (gender === "female") {
      tagFilters.push(
        "Women",
        "Girl",
        "Female",
        "Woman",
        "Girls",
        "Widow",
        "Mother",
        "Pregnant"
      );
    }

    if (gender === "male") {
      tagFilters.push("Men", "Male", "Father");
    }

    // Age groups
    const ageNum = parseInt(age);

    if (ageNum <= 18) tagFilters.push("Child", "Children", "Adolescent", "Student");
    if (ageNum >= 15 && ageNum <= 35) tagFilters.push("Youth", "Young");
    if (ageNum >= 60) tagFilters.push("Senior Citizen", "Old Age", "Elderly", "Veteran Artist");
    if (ageNum >= 18 && ageNum <= 45) tagFilters.push("Adult");

    // Caste
    if (caste === "sc") tagFilters.push("SC", "Scheduled Caste", "Dalit");
    if (caste === "st") tagFilters.push("ST", "Scheduled Tribe", "Tribal", "Adivasi");
    if (caste === "obc") tagFilters.push("OBC", "Other Backward Class");

    // Occupation
    if (occupation === "farmer") tagFilters.push("Farmer", "Agriculture", "Farmers", "Kisan");
    if (occupation === "student") tagFilters.push("Student", "Scholar", "Education");
    if (occupation === "entrepreneur") tagFilters.push("Entrepreneur", "Business", "MSME", "Self-Employed");
    if (occupation === "unemployed") tagFilters.push("Unemployed", "Job Seeker", "Employment");
    if (occupation === "government") tagFilters.push("Government Employee");
    if (occupation === "labourer") tagFilters.push("Labour", "Worker", "Labourer", "Unorganised Worker");

    // Income
    if (income === "bpl") tagFilters.push("BPL", "Below Poverty Line", "Below Poverty Level");
    if (income === "low") tagFilters.push("Low Income", "EWS", "Economically Weaker Section");

    // Special
    if (isDisabled) tagFilters.push("Persons With Disability", "Person With Disability", "Disability", "Divyang");
    if (isStudent) tagFilters.push("Student", "Scholar", "Scholarship");
    if (isVeteran) tagFilters.push("Ex-Servicemen", "Veteran", "Defence");

    const query = {};

    // State filter
    if (state) {
      query.state = { $in: [state, "All"] };
    }

    // Tag matching
    if (tagFilters.length > 0) {
      query.tags = {
        $in: tagFilters.map((t) => new RegExp(t, "i")),
      };
    }

    const schemes = await Scheme.find(query).limit(50).lean();

    // scoring
    const scored = schemes.map((s) => {
      const matchCount = tagFilters.filter((tag) =>
        s.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))
      ).length;

      return { ...s, matchScore: matchCount };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      schemes: scored,
      total: scored.length,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};