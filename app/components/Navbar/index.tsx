import {
    use,
    useCallback,
    useState,
} from 'react';
import {
    CloseLineIcon,
    MenuLineIcon,
} from '@ifrc-go/icons';
import {
    Button,
    DropdownMenu,
    Heading,
    IconButton,
    Image,
    InlineLayout,
    ListView,
    Modal,
} from '@ifrc-go/ui';
import { gql } from 'urql';

import Link from '#components/Link';
import UserContext from '#contexts/UserContext';
import { useLogoutMutation } from '#generated/types/graphql';
import useAlert from '#hooks/useAlert';
import useRouting from '#hooks/useRouting';
import Logo from '#resources/image/logo.png';

import styles from './styles.module.css';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LOGOUT = gql`
    mutation Logout {
        logout
    }
`;

interface Props {
    menuShown?: boolean;
    onMenuButtonClick?: () => void;
}

function Navbar(props: Props) {
    const {
        menuShown,
        onMenuButtonClick,
    } = props;

    const { user, setUser } = use(UserContext);
    const alert = useAlert();
    const navigate = useRouting();

    const [{ fetching: pendingLogout }, triggerLogout] = useLogoutMutation();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const handleLogout = useCallback(async () => {
        const res = await triggerLogout({});
        const logoutResponse = res.data?.logout;
        if (logoutResponse) {
            setShowLogoutConfirm(false);
            setUser(undefined);
            navigate('login');
            alert.show('Logout Successful', { variant: 'success' });
        }
    }, [navigate, triggerLogout, setUser, alert]);

    return (
        <nav className={styles.navbar}>
            <InlineLayout
                withPadding
                withAdditionalInlinePadding
                spacingOffset={1}
                before={(
                    <ListView
                        withSpaceBetweenContents
                    >
                        {onMenuButtonClick && (
                            <div className={styles.menuButton}>
                                <IconButton
                                    name={undefined}
                                    onClick={onMenuButtonClick}
                                    title={menuShown ? 'Close menu' : 'Open menu'}
                                    ariaLabel={menuShown ? 'Close menu' : 'Open menu'}
                                    aria-expanded={menuShown}
                                    variant="tertiary"
                                >
                                    {menuShown ? <CloseLineIcon /> : <MenuLineIcon />}
                                </IconButton>
                            </div>
                        )}
                        <Link
                            to="home"
                        >
                            <ListView spacing="sm">
                                <Image
                                    src={Logo}
                                    className={styles.icon}
                                    withoutBackground
                                />
                                <Heading
                                    level={4}
                                >
                                    ERCS CMS
                                </Heading>
                            </ListView>
                        </Link>
                    </ListView>
                )}
                after={(
                    <DropdownMenu
                        labelStyleVariant="action"
                        labelColorVariant="secondary"
                        label={(
                            <Heading level={6}>
                                {user?.fullName}
                            </Heading>
                        )}
                    >
                        <Button
                            name
                            styleVariant="transparent"
                            onClick={setShowLogoutConfirm}
                            withFullWidth
                        >
                            Logout
                        </Button>
                    </DropdownMenu>
                )}
            />
            {showLogoutConfirm && (
                <Modal
                    heading="Logout"
                    size="sm"
                    onClose={() => setShowLogoutConfirm(false)}
                    footerActions={(
                        <ListView spacing="sm">
                            <Button
                                name={false}
                                onClick={setShowLogoutConfirm}
                                disabled={pendingLogout}
                            >
                                Cancel
                            </Button>
                            <Button
                                name={undefined}
                                styleVariant="filled"
                                onClick={handleLogout}
                                disabled={pendingLogout}
                            >
                                {pendingLogout ? 'Logging out' : 'Logout'}
                            </Button>
                        </ListView>
                    )}
                >
                    Are you sure you want to logout?
                </Modal>
            )}
        </nav>
    );
}

export default Navbar;
