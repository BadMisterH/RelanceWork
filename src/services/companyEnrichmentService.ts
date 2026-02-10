import axios from "axios";

export interface CompanyEnrichment {
  title: string;
  description: string;
  favicon: string;
  domain: string;
}

/**
 * Fetch les meta-tags d'un site web pour enrichir les informations d'une entreprise.
 * Pas d'API externe payante - juste un parsing HTML basique.
 */
export async function enrichCompany(websiteUrl: string): Promise<CompanyEnrichment | null> {
  try {
    // Normaliser l'URL
    let url = websiteUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    const domain = new URL(url).hostname.replace("www.", "");

    const response = await axios.get(url, {
      timeout: 8000,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RelanceWork/1.0)",
        "Accept": "text/html",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
      maxRedirects: 3,
      // Limiter la taille de la reponse pour eviter les gros fichiers
      maxContentLength: 500_000,
    });

    const html: string = response.data;
    if (typeof html !== "string") return null;

    // Extraire le <title>
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1]!.trim() : "";

    // Extraire la meta description (priorite: og:description > description)
    let description = "";

    const ogDescMatch = html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    ) || html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i
    );

    if (ogDescMatch) {
      description = ogDescMatch[1]!.trim();
    } else {
      const descMatch = html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
      ) || html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
      );
      if (descMatch) {
        description = descMatch[1]!.trim();
      }
    }

    // Decouper la description si trop longue
    if (description.length > 300) {
      description = description.substring(0, 297) + "...";
    }

    // Extraire le favicon
    let favicon = "";
    const faviconMatch = html.match(
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i
    ) || html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i
    );

    if (faviconMatch) {
      favicon = faviconMatch[1]!;
      // Si c'est un chemin relatif, le transformer en absolu
      if (favicon.startsWith("/")) {
        favicon = `https://${domain}${favicon}`;
      } else if (!favicon.startsWith("http")) {
        favicon = `https://${domain}/${favicon}`;
      }
    } else {
      // Fallback: favicon.ico standard
      favicon = `https://${domain}/favicon.ico`;
    }

    // Decoder les entites HTML basiques
    description = decodeHtmlEntities(description);
    const decodedTitle = decodeHtmlEntities(title);

    if (!decodedTitle && !description) {
      return null;
    }

    return {
      title: decodedTitle,
      description,
      favicon,
      domain,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.warn(`Enrichissement echoue pour ${websiteUrl}: ${error.message}`);
    } else {
      console.warn(`Enrichissement echoue pour ${websiteUrl}:`, error);
    }
    return null;
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}
