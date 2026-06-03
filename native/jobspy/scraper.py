import sys
import json
import argparse
from jobspy import scrape_jobs
import pandas as pd

def main():
    parser = argparse.ArgumentParser(description="Scrape jobs and output JSON.")
    parser.add_argument("--query", required=True, help="Job title or keywords")
    parser.add_argument("--location", required=True, help="Location")
    parser.add_argument("--sites", help="Comma-separated list of sites (indeed,linkedin,glassdoor,zip_recruiter)", default="indeed,linkedin,zip_recruiter")
    parser.add_argument("--results", type=int, default=10, help="Results per site")
    parser.add_argument("--hours", type=int, default=72, help="Hours old")
    parser.add_argument("--remote", action="store_true", help="Remote only")

    args = parser.parse_args()

    sites = [s.strip() for s in args.sites.split(",") if s.strip()]

    try:
        kwargs = {
            "site_name": sites,
            "search_term": args.query,
            "location": args.location,
            "results_wanted": args.results,
            "hours_old": args.hours,
            "description_format": "markdown",
            "country_indeed": "usa",
            "verbose": 0,
        }

        if args.remote:
            kwargs["is_remote"] = True

        df = scrape_jobs(**kwargs)

        if len(df) == 0:
            print(json.dumps({"success": True, "data": []}))
            return

        # Convert NaNs to None for valid JSON
        df = df.where(pd.notnull(df), None)

        # Convert DataFrame to list of dicts
        records = []
        for _, row in df.iterrows():
            record = row.to_dict()
            # Clean up types and ensure JSON serialization works
            for k, v in record.items():
                if pd.isna(v):
                    record[k] = None
            
            records.append(record)

        print(json.dumps({"success": True, "data": records}, default=str))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
