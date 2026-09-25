import {
    useCallback,
    useMemo,
} from 'react';
import { useParams } from 'react-router';
import { AddFillIcon } from '@ifrc-go/icons';
import {
    Button,
    Container,
    Pager,
    Table,
} from '@ifrc-go/ui';
import {
    createElementColumn,
    createStringColumn,
} from '@ifrc-go/ui/utils';
import {
    isDefined,
    isNotDefined,
} from '@togglecorp/fujs';

import EditDeleteActions, { type Props as EditDeleteActionsProps } from '#components/EditDeleteActions';
import StatusCell from '#components/StatusCell';
import {
    AdminAreaLevel,
    type ExternalDashboardFilter,
    Ordering,
    type ResourceDashboardsQuery,
    useCapacityAndResourceDetailQuery,
    useDeleteResourceDashboardMutation,
    useResourceDashboardsQuery,
} from '#generated/types/graphql';
import useAlert from '#hooks/useAlert';
import useDashboardReorder from '#hooks/useDashboardReorder';
import useFilterState from '#hooks/useFilterState';
import useRegionMap from '#hooks/useRegionMap';
import useRouting from '#hooks/useRouting';
import {
    errorMessage,
    getErrorMessage,
    idSelector,
} from '#utils/common';
import createDragHandleColumn from '#utils/table';

import ResourceDashboardsFilters from './ResourceDashboardsFilters';

type DashboardListItem = NonNullable<NonNullable<ResourceDashboardsQuery['externalDashboards']>['results'][number]> & { no: string };

export interface DashboardFilterType extends Omit<ExternalDashboardFilter, 'isActive'> {
    isActive: string | undefined;
}

const defaultFilter: DashboardFilterType = {
    isActive: undefined,
    search: undefined,
    regions: undefined,
};

function ResourceDashboards() {
    const { id } = useParams();

    const {
        filter,
        rawFilter,
        filtered,
        setFilterField,
        resetFilter,
        page,
        setPage,
        limit,
        offset,
    } = useFilterState({
        filter: defaultFilter,
    });

    const alert = useAlert();
    const navigate = useRouting();

    const regionMap = useRegionMap(AdminAreaLevel.Region);

    const [{ data: detailData }] = useCapacityAndResourceDetailQuery({
        variables: { id: isDefined(id) ? id : '' },
        pause: isNotDefined(id),
    });

    const queryVariables = useMemo(() => ({
        pagination: {
            limit,
            offset,
        },
        filters: {
            capacityAndResources: isDefined(id) ? [id] : undefined,
            isActive: isDefined(filter.isActive) ? filter.isActive === 'true' : undefined,
            search: filter.search || undefined,
            regions: filter.regions?.length ? filter.regions : undefined,
        },
        ordering: [{ order: Ordering.Asc }, { title: Ordering.Asc }],
    }), [limit, offset, filter, id]);

    const [, deleteResourceDashboard] = useDeleteResourceDashboardMutation();
    const [{ fetching, data }, reExecuteQuery] = useResourceDashboardsQuery({
        variables: queryVariables,
        pause: isNotDefined(id),
    });

    const serverData: DashboardListItem[] = useMemo(() => (
        (data?.externalDashboards?.results ?? []).map((dashboard, index) => ({
            ...dashboard,
            no: String((page - 1) * limit + index + 1),
        }))
    ), [page, data, limit]);

    const handleReorderSuccess = useCallback(() => {
        reExecuteQuery({ requestPolicy: 'network-only' });
    }, [reExecuteQuery]);

    const { tableData, rowModifier } = useDashboardReorder(
        serverData,
        page,
        limit,
        handleReorderSuccess,
    );

    const handleDeleteClick = useCallback(
        (dashboardId: string) => {
            deleteResourceDashboard({ id: dashboardId }).then((resp) => {
                const result = resp.data?.deleteExternalDashboard;
                if (result?.ok) {
                    // NOTE: deleting the only row on a page would leave the
                    // user on an empty page
                    if (tableData.length === 1 && page > 1) {
                        setPage(page - 1);
                    } else {
                        reExecuteQuery({ requestPolicy: 'network-only' });
                    }
                    alert.show('Dashboard deleted successfully', { variant: 'success' });
                } else {
                    alert.show(getErrorMessage(resp.error, result?.errors), { variant: 'danger' });
                }
            }).catch(() => {
                alert.show(errorMessage, { variant: 'danger' });
            });
        },
        [deleteResourceDashboard, reExecuteQuery, alert, tableData.length, page, setPage],
    );

    const columns = useMemo(() => [
        createDragHandleColumn<DashboardListItem>(),
        createStringColumn<DashboardListItem, string | number>(
            'no',
            'No.',
            (item) => item.no,
        ),
        createStringColumn<DashboardListItem, string | number>(
            'title',
            'Title',
            (item) => item.title,
        ),
        createStringColumn<DashboardListItem, string | number>(
            'operation',
            'Operation',
            (item) => item.pageDisplay,
        ),
        createStringColumn<DashboardListItem, string | number>(
            'region',
            'Region',
            (item) => (isDefined(item.regionId) ? regionMap[item.regionId] : '-'),
        ),
        createElementColumn<DashboardListItem, string | number, { isActive: boolean }>(
            'status',
            'Status',
            StatusCell,
            (_, datum) => ({
                isActive: datum.isActive,
            }),
        ),
        createElementColumn<DashboardListItem, string | number, EditDeleteActionsProps>(
            'actions',
            '',
            EditDeleteActions,
            (_, datum) => ({
                id: id ?? '',
                dashboard: datum.id,
                onDelete: handleDeleteClick,
                itemTitle: datum.title,
                to: 'editResourceDashboard',
            }),
            { columnWidth: 150 },
        ),
    ], [handleDeleteClick, id, regionMap]);

    const handleCreateClick = useCallback(() => {
        if (isDefined(id)) {
            navigate('createResourceDashboard', { id });
        }
    }, [navigate, id]);

    return (
        <Container
            withPadding
            heading={isDefined(detailData?.capacityAndResource?.title)
                ? `${detailData.capacityAndResource.title} Dashboards`
                : 'Dashboards'}
            headerDescription="Track, organize, and update the dashboards for this capacity and resource"
            filters={(
                <ResourceDashboardsFilters
                    value={rawFilter}
                    onChange={setFilterField}
                    filtered={filtered}
                    onReset={resetFilter}
                />
            )}
            headerActions={(
                <Button
                    name={undefined}
                    onClick={handleCreateClick}
                    before={(<AddFillIcon />)}
                    styleVariant="filled"
                >
                    Create
                </Button>
            )}
            footerActions={(
                <Pager
                    activePage={page}
                    itemsCount={data?.externalDashboards?.totalCount ?? 0}
                    maxItemsPerPage={limit}
                    onActivePageChange={setPage}
                />
            )}
        >
            <Table
                keySelector={idSelector}
                columns={columns}
                data={tableData}
                filtered={filtered}
                pending={fetching}
                rowModifier={rowModifier}
            />
        </Container>
    );
}

export default ResourceDashboards;
