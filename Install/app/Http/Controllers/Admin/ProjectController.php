<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\SystemSetting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProjectController extends Controller
{
    public function index(Request $request): Response
    {
        $tab = $request->get('tab', 'all');
        $search = $request->get('search');
        $sort = $request->get('sort', 'last-edited');

        $query = Project::with('user');

        if ($tab === 'trash') {
            $query->onlyTrashed();
        }

        // Apply search filter (search project name or user name)
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        // Apply sorting
        $query = match ($sort) {
            'name' => $query->orderBy('name', 'asc'),
            'created' => $query->orderBy('created_at', 'desc'),
            default => $query->orderBy('updated_at', 'desc'),
        };

        // Paginate
        $projects = $query->paginate(24)->withQueryString();

        $counts = [
            'all' => Project::count(),
            'trash' => Project::onlyTrashed()->count(),
        ];

        $filters = [
            'search' => $search,
            'sort' => $sort,
        ];

        return Inertia::render('Admin/Projects/Index', [
            'projects' => $projects,
            'counts' => $counts,
            'activeTab' => $tab,
            'filters' => $filters,
            'baseDomain' => SystemSetting::get('domain_base_domain', config('app.base_domain', 'webby.ai')),
        ]);
    }

    public function destroy(Project $project): RedirectResponse
    {
        $project->delete();
        return back()->with('message', __('Project moved to trash by Administrator'));
    }

    public function restore(Project $project): RedirectResponse
    {
        $project->restore();
        return back()->with('message', __('Project restored by Administrator'));
    }

    public function forceDelete(Project $project): RedirectResponse
    {
        $project->forceDelete();
        return back()->with('message', __('Project permanently deleted by Administrator'));
    }
}
