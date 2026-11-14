"""Uji MCP sungguhan lewat klien stdio: daftar alat + panggil alat read-only. Jalankan: uv run --with 'mcp<2' python tools/venue-3d/mcp_selftest.py"""
import asyncio, sys
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    srv = StdioServerParameters(command=sys.executable, args=[str(Path(__file__).with_name("mcp_server.py"))])
    async with stdio_client(srv) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            tools = [t.name for t in (await s.list_tools()).tools]
            print("TOOLS", tools)
            assert {"venue_list_assets", "venue_inspect_glb", "venue_build_assets", "venue_render_preview"} <= set(tools)
            print((await s.call_tool("venue_list_assets", {})).content[0].text)
            print((await s.call_tool("venue_inspect_glb", {"name": "stage"})).content[0].text)
            bad = await s.call_tool("venue_inspect_glb", {"name": "../etc/passwd"})
            assert bad.isError, "input tidak valid harus ditolak"
            print("OK: input tak valid ditolak")
asyncio.run(main())
